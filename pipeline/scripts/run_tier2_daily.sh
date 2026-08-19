#!/bin/zsh
# Daily unattended Tier 2 (search-based) campaign-video discovery.
# Invoked by launchd (~/Library/LaunchAgents/com.ballotwise.tier2video.plist)
# — NOT run from an interactive shell, so PATH/node resolution can't be
# assumed; every path here is absolute for exactly that reason.
#
# Deliberately does NOT publish to R2. scaleVideoTier2.ts only writes
# locally to pipeline/build/ — every result still needs the same
# independent audit (oEmbed cross-check + manual review of anything
# flagged) that caught a real wrong-person match and a recurring
# third-party-media pattern in this project's first two live batches,
# before anything from this script goes live. That review is a judgment
# call no code here makes safely on its own — see the "standing operating
# rule" note in the ballotwise_campaign_video_feature memory. Auditing and
# publishing stays a deliberate, separate step.

set -u
# launchd's default environment doesn't include Homebrew's bin dir — npx
# itself resolves node via a bare "env node" shebang lookup, which fails
# silently (well, loudly, but into a log nobody's watching live) without
# this. Confirmed by testing this script under a stripped environment
# before wiring it into launchd at all: it failed with exactly this error
# until PATH was set explicitly here.
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PIPELINE_DIR="/Users/gustavosorgente/Local/Projects/ballot-wise/pipeline"
LOG_DIR="$PIPELINE_DIR/tier2_logs"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"
cd "$PIPELINE_DIR" || exit 1

{
  echo "=== Tier 2 daily run: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  /opt/homebrew/bin/npx tsx src/ci/scaleVideoTier2.ts
  echo "=== exit code: $? ==="
} >> "$LOG_FILE" 2>&1
