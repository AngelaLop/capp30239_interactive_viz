# Angela Lopez Sanchez

## Description

Build an interactive “life cycle activity explorer” that lets users scrub through ages 3–70 to see how participation in key activities (education, school enrollment, formal employment, caregiving, retirement, etc.) varies across Panama’s territories. The experience blends two centerpieces: (1) an age-by-age simulation inspired by FlowingData’s “A Day in the Life of Americans,” showing how people of a chosen age distribute across activities over a typical day, and (2) a geospatial view that highlights provincial and municipal disparities. A complementary chart will display the activity mix for whichever municipality is active, grounding the qualitative animation with precise percentages. Together these linked views surface spatial inequalities and give readers a concrete sense of how opportunities evolve through the life course.

## Technical Plan re: Option A/B/C/D

- **Chosen option:** Hybrid of Option A (large interactive centerpiece) and Option C (geospatial visualization). Both the map and the age-by-age activity animation act as primary views, tightly coupled through shared controls.
- **Stack:**
  - MapLibre GL JS for the basemap, administrative boundaries, choropleth fills, and smooth zoom/pan.
  - D3.js for data joins, color scaling, the responsive age slider, the municipal activity breakdown chart, and the animation.

- **Key interactions:** An age slider (3–70) re-styles the map, updates the municipal activity chart, and re-parameterizes the age-specific activity simulation. Hover and click expose municipal details, lock selections, and sync the complementary chart. Playback controls (play/pause, age-step) let users watch how the national distribution shifts as the selected age advances.
- **Inspiration:**
  - *A Day in the Life of Americans* (FlowingData): inspires the dot-based Markov simulation to communicate daily activity transitions in an engaging, granular way.
  - *The Best and Worst Places to Grow Up: How Your Area Compares* (NYTimes): geospatial storytelling with hover and complementary graphs.https://www.nytimes.com/interactive/2015/05/03/upshot/the-best-and-worst-places-to-grow-up-how-your-area-compares.html?action=click&contentCollection=The%20Upshot&region=Footer&module=WhatsNext&version=WhatsNext&contentID=WhatsNext&moduleDetail=undefined&pgtype=Multimedia

## Mockup

{
At least one image file with a mock-up of what you're considering.
If multiple images help make the intent clear, please include more.
This can be a quick pen & paper sketch of your current idea, or you can use Inkscape/any tool you wish.
A rough sense of what will be shown and how the user will interact with it should be clear from your illustration(s).
}
- `images/mockup.svg` illustrates an initial layout.

## Data Sources

{
include 1-3 data sources with the following,
you may re-use data sources from before or switch topics
}

### Data Source 1: Censo de Población y Vivienda 2023 (INEC Panamá)

URL: https://ghdx.healthdata.org/record/panama-population-and-housing-census-2023

Size: ~4.1 million individuals enumerated; aggregated tabulations by province/district and age/activity are expected as CSV tables (columns TBD)

The 2023 census provides age-by-activity status (school attendance, employment, labor force participation, caregiving, etc.) at province and district resolution. I will extract indicators that map to key life stages (early childhood education, secondary schooling, tertiary enrollment, employment sectors, retirement). Initial review confirms georeferenced tables and metadata are available;

### Data Source 2: Administrative Boundaries of Panama (COD-AB)

URL: https://data.humdata.org/dataset/cod-ab-pan

Size: 1 GeoPackage with country / province / district layers (81 districts, 6+ attributes)

This Common Operational Dataset maintained by OCHA/Roma Boundary project offers cleaned administrative boundaries aligned with INEC definitions. I will use it to build the map layers and align census tabulations to the correct district codes.

## Questions

{Numbered list of questions for course staff, if any.}

1. Is the hybrid Option A + C approach realistic within the project timeline, or should I scope down to a single centerpiece?
2. Does the outlined technical stack (MapLibre + D3 + Observable/Vite) seem appropriate for the described interactivity and data volume?
