# Top Laps Marshal

A RotorHazard plugin that shows the top 3 best laps of the selected pilot in the Marshal view, with median, IQR, and a progression chart for data verification.

## Features

- **Top 3 best laps** for the selected pilot, filtered by class (or across all classes)
- **Box plot statistics**: median, IQR, quartiles — calculated on "clean" data with outliers removed
- **Δ from median** in three formats: percent, seconds, and IQR units
- **Suspicious lap detection** with configurable thresholds (IQR, %, sec)
- **Outlier flag** (🚩) for laps that fall outside [Q1 − 1.5×IQR, Q3 + 1.5×IQR]
- **Progression chart** showing lap times chronologically with outliers highlighted
- **Interactive chart tooltip** — hover a point to see lap time and source (class / group / round)
- **Adjustable thresholds** in the panel with localStorage persistence
- **Chart visibility toggle** — hide or show the chart, state remembered across sessions
- **Hole shot handling** based on race format's `start_behavior`
- **Live reload** when laps are edited (Commit Changes, Add Lap, Clean Deleted Laps, Discard Changes)

## Installation

1. Open RotorHazard and navigate to **Settings → Plugins**
2. Find **Top Laps Marshal** in the community plugins list and install it
3. Restart RotorHazard
4. Open the **Marshal** page — the panel will appear above the RSSI graph

## Usage

1. Select a pilot in the Marshal view
2. The panel shows the pilot's top 3 best laps in the current class (or all classes)
3. Hover over the **Δ Median** column to see detailed statistics
4. Hover over the **Median · IQR · Total laps** line to see the full distribution and methodology
5. Hover over any point on the chart to see its lap time and source
6. Use the **Thresholds** inputs to adjust when a lap is flagged as suspicious (⚠️)
7. Use **Show chart / Hide chart** to toggle the progression chart

## How it works

The plugin fetches lap data for the selected pilot from all rounds in the current class, filters out deleted laps and hole shots (based on the race format's `start_behavior`), and calculates statistics using the **box plot method**:

- **Median** — middle lap time (50% faster, 50% slower)
- **IQR** — interquartile range (Q3 − Q1), the spread of the middle 50% of laps
- **Outliers** — laps outside [Q1 − 1.5×IQR, Q3 + 1.5×IQR], excluded from statistics but still visible in the top-3 and on the chart
- **⚠️ Suspicious** — a lap is flagged only when **all three** thresholds are met: IQR units, percent from median, and absolute seconds

## Requirements

- RotorHazard 4.5.1 or newer
- RHAPI 1.0 or newer

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

YGR with Deeeeeeeeeepseeeeeeeeek