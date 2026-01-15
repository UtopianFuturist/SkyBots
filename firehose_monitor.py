import asyncio
import os
import json
import sys
import signal
from atproto import AsyncFirehoseSubscribeReposClient, parse_subscribe_repos_message, models, Client, CAR
from atproto.exceptions import AtProtocolError

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# --- Globals for state management and configuration ---
BLUESKY_IDENTIFIER = os.getenv('BLUESKY_IDENTIFIER')
BLUESKY_APP_PASSWORD = os.getenv('BLUESKY_APP_PASSWORD')
CURSOR_FILE = os.getenv('CURSOR_FILE_PATH', '/data/firehose_cursor.txt')

latest_seq = 0

# --- Cursor Saving and Shutdown Handling ---
def save_cursor():
    """Saves the latest sequence number to the cursor file."""
    global latest_seq
    if latest_seq > 0:
        try:
            with open(CURSOR_FILE, 'w') as f:
                f.write(str(latest_seq))
            print(f"Saved cursor: {latest_seq}", file=sys.stderr)
        except Exception as e:
            print(f"Error saving cursor to {CURSOR_FILE}: {e}", file=sys.stderr)

def handle_shutdown(sig, frame):
    """Signal handler for graceful shutdown."""
    print("Shutdown signal received. Saving final cursor...", file=sys.stderr)
    save_cursor()
    sys.exit(0)

async def periodic_saver():
    """Periodically saves the cursor to disk."""
    while True:
        await asyncio.sleep(10)  # Save every 10 seconds
        save_cursor()

# --- Main Application Logic ---
async def main():
    """Main function to setup and run the firehose monitor."""
    if not BLUESKY_IDENTIFIER or not BLUESKY_APP_PASSWORD:
        print("Error: BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD not set in environment.", file=sys.stderr)
        sys.exit(1)

    # Setup graceful shutdown handlers
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    client = Client()
    try:
        profile = client.login(BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD)
        bot_did = profile.did
        print(f"Logged in as {BLUESKY_IDENTIFIER} (DID: {bot_did})", file=sys.stderr)
    except Exception as e:
        print(f"Error logging in: {e}", file=sys.stderr)
        sys.exit(1)

    # Read the last known cursor position
    cursor = None
    try:
        with open(CURSOR_FILE, 'r') as f:
            cursor_val = f.read().strip()
            if cursor_val:
                cursor = int(cursor_val)
                print(f"Resuming from cursor: {cursor}", file=sys.stderr)
    except FileNotFoundError:
        print(f"Cursor file not found at {CURSOR_FILE}. Starting from latest.", file=sys.stderr)
    except ValueError:
        print("Invalid cursor value found. Starting from latest.", file=sys.stderr)
        cursor = None

    global latest_seq
    if cursor:
        latest_seq = cursor

    params = models.ComAtprotoSyncSubscribeRepos.Params(cursor=cursor) if cursor else None
    firehose = AsyncFirehoseSubscribeReposClient(params)

    async def on_message_handler(message):
        """Callback for processing incoming firehose messages."""
        nonlocal bot_did
        global latest_seq
        commit = parse_subscribe_repos_message(message)
        if not isinstance(commit, models.ComAtprotoSyncSubscribeRepos.Commit):
            return

        # Update the latest sequence number in memory
        latest_seq = commit.seq

        for op in commit.ops:
            if op.action != 'create' or not op.path.startswith('app.bsky.feed.post/'):
                continue

            try:
                car = CAR.from_bytes(commit.blocks)
                record_raw = car.blocks.get(op.cid)
                if not record_raw:
                    continue

                # --- Event Detection Logic ---
                # Reply to bot
                reply = record_raw.get('reply', {})
                is_reply_to_bot = bot_did in reply.get('parent', {}).get('uri', '') if reply else False
                
                # Mention of bot
                is_mention_of_bot = False
                for facet in record_raw.get('facets', []):
                    for feature in facet.get('features', []):
                        if feature.get('$type') == 'app.bsky.richtext.facet#mention' and feature.get('did') == bot_did:
                            is_mention_of_bot = True
                            break
                    if is_mention_of_bot:
                        break
                
                # Quote repost of bot
                embed = record_raw.get('embed', {})
                is_quote_of_bot = bot_did in embed.get('record', {}).get('uri', '') if embed.get('$type') == 'app.bsky.embed.record' else False

                if is_reply_to_bot or is_mention_of_bot or is_quote_of_bot:
                    reason = "mention" if is_mention_of_bot else "quote" if is_quote_of_bot else "reply"
                    event = {
                        "type": "firehose_mention",
                        "uri": f"at://{commit.repo}/{op.path}",
                        "cid": str(op.cid),
                        "author": {"did": commit.repo, "handle": None},
                        "record": record_raw,
                        "reason": reason
                    }
                    print(json.dumps(event), flush=True)

            except Exception as e:
                print(f"Error processing firehose event: {e}", file=sys.stderr)

    # Start the periodic saver as a background task
    saver_task = asyncio.create_task(periodic_saver())

    print("Starting firehose monitoring...", file=sys.stderr)
    try:
        await firehose.start(on_message_handler)
    except Exception as e:
        print(f"Firehose error: {e}", file=sys.stderr)
    finally:
        # Clean up on exit, though signal handler is the primary mechanism
        print("Firehose stream stopped. Finalizing...", file=sys.stderr)
        saver_task.cancel()
        save_cursor()

if __name__ == "__main__":
    asyncio.run(main())
