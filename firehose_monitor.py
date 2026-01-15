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

CURSOR_FILE = 'firehose_cursor.txt'

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

    cursor = None
    try:
        with open(CURSOR_FILE, 'r') as f:
            cursor_val = f.read().strip()
            if cursor_val:
                cursor = int(cursor_val)
                print(f"Resuming from cursor: {cursor}", file=sys.stderr)
    except FileNotFoundError:
        print("Cursor file not found. Starting from latest.", file=sys.stderr)
    except ValueError:
        print("Invalid cursor value found. Starting from latest.", file=sys.stderr)
        cursor = None

    params = models.ComAtprotoSyncSubscribeRepos.Params(cursor=cursor) if cursor else None
    firehose = AsyncFirehoseSubscribeReposClient(params)

    async def on_message_handler(message):
        commit = parse_subscribe_repos_message(message)
        if not isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit):
            return

        # Always update and save the latest sequence number to file
        with open(CURSOR_FILE, 'w') as f:
            f.write(str(commit.seq))

        for op in commit.ops:
            if op.action != 'create':
                continue

            if not op.path.startswith('app.bsky.feed.post/'):
                continue

            # We found a new post!
            try:
                # The record is in the blocks (CAR format)
                # atproto-python handles the decoding if we use the right helpers
                # but for simplicity in this script, we can just check if the post
                # is a reply to our bot's DID.
                
                # To get the record content, we need to find it in the blocks
                # This is a bit complex with raw CAR, but atproto-python provides
                # a way to get the record from the commit.
                
                # Let's use a simpler approach: if the record is a post, 
                # we check if it mentions the bot or is a reply to the bot.
                
                # Note: op.cid is the CID of the record
                # We can use the client to get the record if needed, 
                # but that defeats the purpose of the firehose speed.
                # Instead, we should decode the block.
                
                # atproto-python's parse_subscribe_repos_message handles 
                # the basic structure. To get the actual record:
                car = CAR.from_bytes(commit.blocks)
                record_raw = car.blocks.get(op.cid)
                
                if not record_raw:
                    continue
                
                # record_raw is a dict representing the post
                # Check for replies to the bot
                reply = record_raw.get('reply')
                is_reply_to_bot = False
                if reply:
                    parent_uri = reply.get('parent', {}).get('uri', '')
                    if bot_did in parent_uri:
                        is_reply_to_bot = True
                
                # Check for mentions of the bot's DID in the text or facets
                text = record_raw.get('text', '')
                facets = record_raw.get('facets', [])
                is_mention_of_bot = False
                
                for facet in facets:
                    for feature in facet.get('features', []):
                        if feature.get('$type') == 'app.bsky.richtext.facet#mention' and feature.get('did') == bot_did:
                            is_mention_of_bot = True
                            break
                    if is_mention_of_bot:
                        break
                
                # Check for quote reposts of the bot's posts
                embed = record_raw.get('embed', {})
                is_quote_of_bot = False
                if embed.get('$type') == 'app.bsky.embed.record':
                    record_uri = embed.get('record', {}).get('uri', '')
                    if bot_did in record_uri:
                        is_quote_of_bot = True

                if is_reply_to_bot or is_mention_of_bot or is_quote_of_bot:
                    # Determine the reason for the event
                    if is_mention_of_bot:
                        reason = "mention"
                    elif is_quote_of_bot:
                        reason = "quote"
                    else:
                        reason = "reply"

                    # Construct a notification-like object to send to the Node.js bot
                    event = {
                        "type": "firehose_mention",
                        "uri": f"at://{commit.repo}/{op.path}",
                        "cid": str(op.cid),
                        "author": {
                            "did": commit.repo,
                            "handle": None # We'll need to resolve this in Node.js if needed
                        },
                        "record": record_raw,
                        "reason": reason
                    }
                    print(json.dumps(event), flush=True)

            except Exception as e:
                print(f"Error processing firehose event: {e}", file=sys.stderr)

    print("Starting firehose monitoring...", file=sys.stderr)
    try:
        await firehose.start(on_message_handler)
    except Exception as e:
        print(f"Firehose error: {e}", file=sys.stderr)

if __name__ == "__main__":
    asyncio.run(main())
