# Panama Life Cycle Activity Explorer

Interactive visualization exploring how participation in key life cycle activities (education, employment, unemployment, inactivity, retirement) varies across Panama's territories by age and gender.

**Live Demo:** https://angelalop.github.io/capp30239_interactive_viz/

## Description

This project builds an interactive "life cycle activity explorer" that lets users scrub through ages 3–70 to see how participation in key activities varies across Panama's municipalities and provinces. The visualization features:

- Interactive choropleth map showing dominant activities by territory
- Age slider with auto-play functionality
- Sex filter (All, Male, Female)
- Two view modes: Total (all municipalities) and By Province (filtered view)
- Detailed activity breakdown charts for selected territories
- Hover tooltips with complete activity percentages

## Technical Stack

- **D3.js v7** for map rendering, data joins, scales, and interactive charts
- **HTML/CSS/JavaScript** for the frontend
- **Python/GeoPandas** for data processing and GeoJSON conversion
- **GitHub Pages** for deployment

## Data Sources

- **Censo de Población y Vivienda 2023** (INEC Panamá): 2023 Panama Population Census
- **Administrative Boundaries of Panama** (COD-AB): Administrative boundaries from OCHA/Roma Boundary project

## Acknowledgments

This project was developed with assistance from AI coding tools (Cursor AI) for implementation guidance, debugging, and code optimization.

### Learning Resources

The following resources were instrumental in understanding D3.js concepts and patterns used in this project:

- **[D3 in Depth](https://www.d3indepth.com/)** - Comprehensive guide to D3.js covering selections, data joins, scales, and maps
- **[Thinking with Joins](https://bost.ocks.org/mike/join/)** by Mike Bostock - Essential reading on D3's enter/update/exit pattern, which is fundamental to the map rendering and data binding in this visualization

The codebase extensively uses D3's data join pattern (enter/update/exit) for efficient DOM updates when filtering by age and sex, as well as for rendering the choropleth map paths and activity breakdown charts.
