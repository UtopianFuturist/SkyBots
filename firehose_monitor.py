import asyncio
import os
import json
import sys
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

                    reply = record_raw.get('reply')
                    is_reply_to_bot = False
                    if reply:
                        parent_uri = reply.get('parent', {}).get('uri', '')
                        if bot_did in parent_uri:
                            is_reply_to_bot = True

                    text = record_raw.get('text', '')
                    facets = record_raw.get('facets', [])
                    is_mention_of_bot = bot_did in text

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
                    if embed.get('$type') == 'app.bsky.embed.record':
                        record_uri = embed.get('record', {}).get('uri', '')
                        if bot_did in record_uri:
                            is_quote_of_bot = True

                    if is_reply_to_bot or is_mention_of_bot or is_quote_of_bot:
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
                        print(f"Detected event for DID {commit.repo} (Reason: {reason})", file=sys.stderr)

                except Exception as e:
                    print(f"Error processing firehose op: {e}", file=sys.stderr)

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
