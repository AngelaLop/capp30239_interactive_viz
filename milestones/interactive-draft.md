# Panama Life Cycle Activity Explorer

Angela Lopez

## Goal

{What is your current goal? Has it changed since the proposal?}
Build an interactive "life cycle activity explorer" that lets users scrub through ages 3–70 to see how participation in key activities (school enrollment, employment, unemployment, inactivity, retirement) varies across Panama's territories, and gender. The goal hasn't changed, but as advised, I focused only on one of the two visualizations I had proposed (the interactive map, leaving out the simulation). 

## Data Challenges

No data challenges I am using the 2023 Panama Census. however some technical challenges emerged during processing:

 **Large File Sizes:** The initial aggregated dataset was 2.6 GB, far too large for browser loading. I optimized the data by:
   - Creating compact versions with shorter column names (e.g., `cod_corr` - `c`, `age` - `a`)
   - Converting numeric columns to `int32` to reduce file size
   - Splitting the data into four age-range files (`ages_3_20.json`, `ages_21_40.json`, `ages_41_60.json`, `ages_61_70.json`) for on-demand loading
   - Optimizing GeoJSON files by simplifying geometries and reducing coordinate precision (from ~100MB+ to 4-9MB each)

## Walk Through

**Initial View:**
When the page loads, users see a choropleth map of Panama showing all municipalities. The map is color-coded by the dominant activity for age 3 (the default), with all sexes combined. The left panel explains the visualization and defines each activity category with color-coded labels. Below the map, two charts show the national activity distribution and a placeholder for municipality details.

**Exploring by Age:**
1. **Manual Exploration:** Users can drag the age slider (3-70) in the header to see how activity patterns change across the life course. As they move the slider, the map updates in real-time, showing which activity dominates each municipality at that age. The large age number in the header updates to reflect the current selection.

2. **Auto-Play:** Users can click the play button next to the slider to automatically advance through ages every 0.5 seconds. This creates an animated view of how Panama's activity landscape evolves from childhood through retirement. The play button toggles to pause when active, and users can stop it at any time.

**Filtering by Sex:**
Users can click the sex filter buttons (All, Male, Female) to compare gender differences. When "Male" or "Female" is selected, the map updates to show activity patterns for that specific group, revealing spatial inequalities in opportunities across Panama's territories.

**Interacting with the Map:**
1. **Hover:** When users hover over any municipality, a tooltip appears showing:
   - The municipality name
   - The dominant activity and its percentage
   - A breakdown of all activities as percentages for that territory

2. **Click:** Clicking on a municipality "locks" that selection and updates the "Municipality Activity Breakdown" chart below with a detailed bar chart showing the exact distribution of all activities for that territory at the current age and sex filter. The auto-play automatically stops when a territory is selected to allow users to examine the details.

**Switching Views:**
Users can switch between two tabs:
- **Total:** Shows the entire country with all municipalities, allowing users to compare patterns across all of Panama.
- **By Province:** Provides a dropdown to select a specific province (default: Panama). The map then zooms to show only municipalities within that province, making it easier to see local patterns. The charts update to compare against province-level figures rather than national figures.

**Zoom and Navigation:**
Users can zoom in/out and pan the map using the zoom controls (+/−/⌂) or by dragging. This is particularly useful in the "By Province" view to explore municipalities in detail.

**Example Interaction Flow:**
A user might start by setting the age to 18 and selecting "Female" to see where young women are most likely to be students. They notice a municipality with high student rates, hover to see the tooltip, then click to lock that selection and examine the detailed breakdown in the chart below. They then switch to the "By Province" tab, select "Panama" province, and use the play button to watch how activity patterns change as they advance through ages 20-30, observing the transition from education to employment.
currently I deployed the vizualization here https://angelalop.github.io/capp30239_interactive_viz/

## Questions

Given the state  of the project, you think I an try to make the simulation? if so, how do I start?