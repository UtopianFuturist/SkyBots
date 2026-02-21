import asyncio
import os
import json
import sys
import argparse
from atproto import AsyncFirehoseSubscribeReposClient, parse_subscribe_repos_message, models, Client, CAR
from atproto.exceptions import AtProtocolError

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

BLUESKY_IDENTIFIER = os.getenv('BLUESKY_IDENTIFIER')
BLUESKY_APP_PASSWORD = os.getenv('BLUESKY_APP_PASSWORD')

def make_serializable(obj):
    if isinstance(obj, bytes):
        try:
            return obj.decode('utf-8')
        except UnicodeDecodeError:
            return obj.hex()
    if hasattr(obj, 'cid'):
        return str(obj.cid)
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_serializable(i) for i in obj]
    return obj

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--keywords', type=str, help='Comma-separated list of keywords to monitor')
    parser.add_argument('--negatives', type=str, help='Comma-separated list of negative keywords to filter out')
    parser.add_argument('--actors', type=str, help='Comma-separated list of DIDs to monitor specifically')
    args = parser.parse_args()

    keywords = []
    if args.keywords:
        keywords = [k.strip().lower() for k in args.keywords.split('|') if k.strip()]
        print(f"Monitoring firehose for keywords: {keywords}", file=sys.stderr)

    negatives = []
    if args.negatives:
        negatives = [k.strip().lower() for k in args.negatives.split('|') if k.strip()]
        print(f"Filtering out negative keywords: {negatives}", file=sys.stderr)

    actors = []
    if args.actors:
        actors = [a.strip() for a in args.actors.split(',') if a.strip()]
        print(f"Monitoring firehose for actors: {actors}", file=sys.stderr)

    if not BLUESKY_IDENTIFIER or not BLUESKY_APP_PASSWORD:
        print("Error: BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD not set in environment.")
        sys.exit(1)

    client = Client()
    try:
        profile = client.login(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)
        bot_did = profile.did
        print(f"Logged in as {BLUESKY_IDENTIFIER} (DID: {bot_did})", file=sys.stderr)
    except Exception as e:
        print(f"Error logging in: {e}", file=sys.stderr)
        sys.exit(1)

    firehose = AsyncFirehoseSubscribeReposClient()

    async def on_message_handler(message):
        try:
            commit = parse_subscribe_repos_message(message)
            if not isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit):
                return

            if not commit.blocks:
                return

            car = None
            try:
                car = CAR.from_bytes(commit.blocks)
            except Exception:
                # Silently skip malformed blocks
                return

            for op in commit.ops:
                if op.action != 'create' or not op.path.startswith('app.bsky.feed.post/'):
                    continue

                try:
                    record_raw = car.blocks.get(op.cid)
                    if not record_raw:
                        continue

                    text = record_raw.get('text', '').lower()

                    # 1. Check for mentions/replies (existing logic)
                    reply = record_raw.get('reply')
                    is_reply_to_bot = False
                    if reply:
                        parent_uri = reply.get('parent', {}).get('uri', '')
                        if bot_did in parent_uri:
                            is_reply_to_bot = True

                    facets = record_raw.get('facets', [])
                    is_mention_of_bot = bot_did in record_raw.get('text', '')

                    if not is_mention_of_bot:
                        for facet in facets:
                            for feature in facet.get('features', []):
                                if feature.get('$type') == 'app.bsky.richtext.facet#mention' and feature.get('did') == bot_did:
                                    is_mention_of_bot = True
                                    break
                            if is_mention_of_bot:
                                break

                    embed = record_raw.get('embed', {})
                    is_quote_of_bot = False
                    # Handle both app.bsky.embed.record and app.bsky.embed.recordWithMedia
                    quote_embed = None
                    if embed.get('$type') == 'app.bsky.embed.record':
                        quote_embed = embed
                    elif embed.get('$type') == 'app.bsky.embed.recordWithMedia':
                        quote_embed = embed.get('record')

                    if quote_embed:
                        record_uri = quote_embed.get('record', {}).get('uri', '')
                        if bot_did in record_uri:
                            is_quote_of_bot = True

                    if is_reply_to_bot or is_mention_of_bot or is_quote_of_bot:
                        print(f"[Firehose Monitor] Detected {'mention' if is_mention_of_bot else ('quote' if is_quote_of_bot else 'reply')} from {commit.repo}", file=sys.stderr)
                        if is_mention_of_bot:
                            reason = "mention"
                        elif is_quote_of_bot:
                            reason = "quote"
                        else:
                            reason = "reply"

                        event = {
                            "type": "firehose_mention",
                            "uri": f"at://{commit.repo}/{op.path}",
                            "cid": str(op.cid),
                            "author": {
                                "did": commit.repo,
                                "handle": None
                            },
                            "record": make_serializable(record_raw),
                            "reason": reason
                        }
                        print(json.dumps(event), flush=True)
                        continue # Already handled

                    # 1b. Check for specifically tracked actors (Proposal 4)
                    if actors and commit.repo in actors:
                        event = {
                            "type": "firehose_actor_match",
                            "uri": f"at://{commit.repo}/{op.path}",
                            "cid": str(op.cid),
                            "author": {
                                "did": commit.repo,
                                "handle": None
                            },
                            "record": make_serializable(record_raw)
                        }
                        print(json.dumps(event), flush=True)
                        continue

                    # 2. Check for keyword matches
                    if keywords:
                        # Item 11: Anti-Spam Keyword Negation
                        is_spam = any(n in text for n in negatives)
                        if is_spam:
                            continue

                        matched_keywords = [k for k in keywords if k in text]
                        if matched_keywords:
                            event = {
                                "type": "firehose_topic_match",
                                "uri": f"at://{commit.repo}/{op.path}",
                                "cid": str(op.cid),
                                "author": {
                                    "did": commit.repo,
                                    "handle": None
                                },
                                "record": make_serializable(record_raw),
                                "matched_keywords": matched_keywords
                            }
                            print(json.dumps(event), flush=True)

                except Exception as e:
                    # Ignore individual op errors
                    pass

        except Exception as e:
            # Main handler error
            pass

    print(f"Starting firehose monitoring for bot {bot_did}...", file=sys.stderr)
    try:
        await firehose.start(on_message_handler)
    except Exception as e:
        print(f"Firehose error: {e}", file=sys.stderr)
        raise

if __name__ == "__main__":
    asyncio.run(main())
