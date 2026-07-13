#!/usr/bin/env bash
# Run tests for each package sequentially with a real-time compact progress
# display, then print a summary table.
set -o pipefail

declare -a PKG_NAMES=()
declare -a PKG_STATUSES=()
declare -a PKG_SUMMARIES=()
declare -a PKG_TIMES=()
OVERALL_EXIT=0
OVERALL_START=$(date +%s)

# Auto-discover packages that have a "test" script in their package.json
packages=()
for dir in packages/* demo; do
  if [ -d "$dir" ] && grep -q '"test"' "$dir/package.json" 2>/dev/null; then
    packages+=("$dir")
  fi
done

if [ ${#packages[@]} -eq 0 ]; then
  printf "No packages with test scripts found.\n"
  exit 0
fi

total=${#packages[@]}
current=0

for pkg in "${packages[@]}"; do
  name=$(basename "$pkg")
  current=$((current + 1))

  # Count test files for progress display
  total_test_files=$(find "$pkg" -not -path "*/node_modules/*" \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) 2>/dev/null | wc -l)
  total_test_files=$((total_test_files + 0)) # trim whitespace

  printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  printf " 📦 [%d/%d] %s (%d test files)\n" "$current" "$total" "$name" "$total_test_files"
  printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

  # Reserve 5 lines for the progress display (separator + 5 display lines)
  printf "\n"
  printf "  ⏳ Running tests...\n"
  printf "\n\n\n\n"

  tmpfile=$(mktemp)
  pkg_start=$(date +%s)

  # Run vitest with verbose reporter so we get per-test output.
  # Pipe through awk which suppresses raw output (saves to tmpfile)
  # and renders a compact in-place progress display.
  (cd "$pkg" && bun vitest run --reporter=verbose 2>&1) | awk -v outfile="$tmpfile" -v total_files="$total_test_files" '
  BEGIN {
    passed = 0; failed = 0; test_count = 0
    prev_desc = ""; prev_icon = ""
    curr_desc = ""; curr_icon = ""
    files_seen = 0
  }
  {
    # Save all output to file (for summary extraction and failure details)
    print >> outfile
    fflush(outfile)

    # Strip ANSI escape codes for pattern matching
    clean = $0
    gsub(/\033\[[0-9;]*m/, "", clean)
    gsub(/\r/, "", clean)

    # Match verbose vitest test result lines:
    #   ✓ src/file.test.ts > suite > test name  Nms
    # They contain .test./.spec. AND " > " (suite separator)
    # Exclude stderr capture lines from vitest
    if (clean ~ /\.(test|spec)\./ && clean ~ / > / && clean !~ /^[[:space:]]*stderr/) {
      test_count++

      # Prefer the result symbol because Vitest may use different ANSI green
      # variants (for example 32m or 92m) across versions and terminals.
      if (clean ~ /^[[:space:]]*(✓|√)/ || $0 ~ /\033\[(32|92)m/) {
        passed++
        icon = "\033[32m\342\234\223\033[0m"
      } else {
        failed++
        icon = "\033[31m\342\234\227\033[0m"
      }

      # Extract description from cleaned line
      desc = clean
      sub(/^[[:space:]]*/, "", desc)    # strip leading whitespace
      sub(/^[^ ]+ /, "", desc)          # strip status symbol + space

      # Extract file name (before first " > ") for file tracking
      file = desc
      sub(/ > .*/, "", file)
      if (!(file in seen_files)) {
        seen_files[file] = 1
        files_seen++
      }

      # Remove trailing timing (e.g., "1ms", "1.23s")
      sub(/ [0-9][0-9.]*m?s$/, "", desc)

      # Truncate long descriptions
      if (length(desc) > 68) desc = substr(desc, 1, 65) "..."

      # Shift current to previous
      prev_desc = curr_desc
      prev_icon = curr_icon
      curr_desc = desc
      curr_icon = icon

      # Move cursor up 5 lines and redraw the display
      printf "\033[5A"

      # Line 1: previous test
      if (prev_desc != "") {
        printf "\033[2K  %s %s\n", prev_icon, prev_desc
      } else {
        printf "\033[2K\n"
      }

      # Line 2: current test (just completed)
      printf "\033[2K  %s %s\n", curr_icon, curr_desc

      # Line 3: remaining
      remaining = (total_files + 0) - files_seen
      if (remaining > 0) {
        printf "\033[2K  \033[2m\342\227\213 %d files remaining...\033[0m\n", remaining
      } else {
        printf "\033[2K  \033[2m\342\227\213 waiting for summary...\033[0m\n"
      }

      # Line 4: blank separator
      printf "\033[2K\n"

      # Line 5: running totals
      printf "\033[2K  \342\224\200\342\224\200 %d/%d files | \033[32m%d passed\033[0m", files_seen, total_files, passed
      if (failed > 0) printf " | \033[31m%d failed\033[0m", failed
      printf " | %d tests \342\224\200\342\224\200\n", test_count

      fflush()
    }
  }'

  exit_code=${PIPESTATUS[0]}
  pkg_end=$(date +%s)
  elapsed=$((pkg_end - pkg_start))
  PKG_TIMES+=("${elapsed}s")

  printf "  ⏱  Completed in %ds\n" "$elapsed"

  # If tests failed, show the captured vitest output for debugging
  if [ $exit_code -ne 0 ]; then
    printf "\n  ── Failure details ──\n\n"
    cat "$tmpfile"
  fi

  output=$(cat "$tmpfile")
  rm -f "$tmpfile"

  PKG_NAMES+=("$name")

  if [ $exit_code -eq 0 ]; then
    PKG_STATUSES+=("PASS")
  else
    PKG_STATUSES+=("FAIL")
    OVERALL_EXIT=1
  fi

  # Extract test/file counts from vitest output for summary table
  test_line=$(echo "$output" | grep -E "Tests\s+" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | sed 's/^[[:space:]]*//')
  file_line=$(echo "$output" | grep -E "Test Files\s+" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | sed 's/^[[:space:]]*//')
  if [ -n "$file_line" ] && [ -n "$test_line" ]; then
    PKG_SUMMARIES+=("$file_line | $test_line")
  else
    PKG_SUMMARIES+=("(no summary available)")
  fi
done

OVERALL_END=$(date +%s)
OVERALL_ELAPSED=$((OVERALL_END - OVERALL_START))

# Print summary table
printf "\n"
printf "╔══════════════════════════════════════════════════════════════════════════════════╗\n"
printf "║                              TEST SUMMARY                                      ║\n"
printf "╠══════════════════════════════════════════════════════════════════════════════════╣\n"

for i in "${!PKG_NAMES[@]}"; do
  status="${PKG_STATUSES[$i]}"
  name="${PKG_NAMES[$i]}"
  summary="${PKG_SUMMARIES[$i]}"
  elapsed="${PKG_TIMES[$i]}"

  if [ "$status" = "PASS" ]; then
    icon="✅"
  else
    icon="❌"
  fi

  printf "║  %s %-20s %-6s %s\n" "$icon" "$name" "$elapsed" "$summary"
done

printf "╠══════════════════════════════════════════════════════════════════════════════════╣\n"
printf "║  Total time: %ds\n" "$OVERALL_ELAPSED"
printf "╚══════════════════════════════════════════════════════════════════════════════════╝\n"

if [ $OVERALL_EXIT -eq 0 ]; then
  printf "\n✅ All packages passed!\n\n"
else
  printf "\n❌ Some packages have failing tests.\n\n"
fi

exit $OVERALL_EXIT
