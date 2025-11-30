if (typeof d3 === 'undefined') {
    console.error("D3.js is not loaded");
    alert("Error: D3.js library not found.");
}

const CONFIG = {
    mapWidth: 900,
    mapHeight: 500
};

const activityColors = {
    'student': '#FDCA81',
    'student_worker': '#FFA552',
    'worker_low': '#BA5624',
    'worker_high': '#381D2A',
    'unemployed': '#295249',
    'inactive': '#C4D6B0',
    'retired': '#DAE7E9',
    'no_data': '#FFFFFF'
};

let currentAge = 3;
let currentView = 'total';
let selectedSex = 'all';
let selectedProvince = null;
let aggregatedData = [];
let municipalitiesData = null;
let provincesData = null;
let dataCache = new Map();
let ageIndexBuilt = false;
let updateTimeout = null;
let isUpdating = false;
let playInterval = null;
let isPlaying = false;

const maps = {
    total: { svg: null, projection: null, path: null, group: null, zoom: null },
    province: { svg: null, projection: null, path: null, group: null, zoom: null }
};

window.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    try {
        if (typeof d3 === 'undefined') return;
        loadData();
    } catch (error) {
        console.error("Fatal error in initializeApp:", error);
        showError("Failed to initialize application");
    }
}

function loadData() {
    const dataFiles = [
        "data/ages_3_20.json",
        "data/ages_21_40.json",
        "data/ages_41_60.json",
        "data/ages_61_70.json"
    ];
    
    console.log("Loading data files...");
    
    Promise.all([
        d3.json("geo/panama_municipalities.geojson").catch(err => {
            console.error("Failed to load panama_municipalities.geojson:", err);
            throw new Error("Failed to load municipalities GeoJSON file. This may be a Git LFS issue.");
        }),
        d3.json("geo/panama_provinces.geojson").catch(err => {
            console.error("Failed to load panama_provinces.geojson:", err);
            throw new Error("Failed to load provinces GeoJSON file. This may be a Git LFS issue.");
        }),
        ...dataFiles.map(f => d3.json(f).catch(err => {
            console.warn(`Failed to load ${f}:`, err);
            return [];
        }))
    ])
    .then(([municipalities, provinces, ...ageData]) => {
        console.log("GeoJSON files loaded successfully");
        console.log("Municipalities:", municipalities?.features?.length || 0);
        console.log("Provinces:", provinces?.features?.length || 0);
        
        if (!municipalities || !municipalities.features) {
            throw new Error("Municipalities GeoJSON is invalid or empty");
        }
        if (!provinces || !provinces.features) {
            throw new Error("Provinces GeoJSON is invalid or empty");
        }
        
        municipalitiesData = municipalities;
        provincesData = provinces;
        aggregatedData = ageData.flat().filter(d => d);
        
        console.log("Age data files loaded:", aggregatedData.length, "records");
        
        if (aggregatedData.length === 0) {
            console.log("No age data found, trying fallback files...");
            return Promise.all([
                d3.json("data/aggregated_compact.json").catch(() => []),
                d3.json("data/aggregated_by_age_sex_quintile.json").catch(() => [])
            ]).then(([compact, full]) => {
                aggregatedData = compact.length > 0 ? compact : full;
                console.log("Fallback data loaded:", aggregatedData.length, "records");
            });
        }
    })
    .then(() => {
        initializeMaps();
        setupProvinceDropdown();
        setupControls();
        setInitialVisibility();
        updateAllMaps();
    })
    .catch(error => {
        console.error("Error loading data:", error);
        console.error("Error details:", error.message, error.stack);
        showError(`Failed to load data files: ${error.message}. Check browser console for details.`);
    });
}

function setInitialVisibility() {
    d3.select("#map-total").style("display", "block");
    d3.select("#map-container-single .zoom-controls").style("display", "flex");
    d3.select("#legend-total").style("display", "block");
    d3.select("#map-province").style("display", "none");
    d3.select("#map-container-province .zoom-controls").style("display", "none");
    d3.select("#legend-province").style("display", "none");
    d3.select(".province-controls").style("display", "none");
}

function initializeMaps() {
    initializeMap('total', '#map-total', CONFIG.mapWidth, CONFIG.mapHeight);
    initializeMap('province', '#map-province', CONFIG.mapWidth, CONFIG.mapHeight - 60);
    initializeLegend('#legend-total');
    initializeLegend('#legend-province');
}

function initializeMap(mapId, selector, width, height) {
    const svg = d3.select(selector)
        .attr("width", width)
        .attr("height", height);
    
    const group = svg.append("g").attr("class", "map-group");
    const projection = d3.geoMercator();
    const path = d3.geoPath().projection(projection);
    
    const padding = 40;
    const topPadding = 20;
    
    projection.fitSize([width - padding * 2, height - padding * 2], municipalitiesData);
    const [tx, ty] = projection.translate();
    projection.translate([tx + padding, ty + topPadding]);
    
    maps[mapId] = {
        svg, projection, path, group,
        initialScale: projection.scale(),
        initialTranslate: projection.translate()
    };
    
    if (mapId === 'total') {
        createMapPaths(group, path, mapId);
        addPanamaCityMarker(group, projection);
    }
    
    setupZoom(mapId);
}

function createMapPaths(group, path, mapId) {
    group.selectAll("path")
        .data(municipalitiesData.features)
        .enter()
        .append("path")
        .attr("class", "municipality")
        .attr("d", path)
        .attr("stroke", "#bbb")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#2c3e50").attr("stroke-width", 1);
            showTooltip(event, d, mapId);
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "#bbb").attr("stroke-width", 0.5);
            hideTooltip(mapId);
        })
        .on("click", function(event, d) {
            selectMunicipality(d, mapId);
        });
}

function addPanamaCityMarker(group, projection) {
    const panamaCityCoords = [-79.5167, 8.9833];
    const [x, y] = projection(panamaCityCoords);
    
    const starPath = "M 0,-12 L 3,-4 L 12,-4 L 5,1 L 7,10 L 0,5 L -7,10 L -5,1 L -12,-4 L -3,-4 Z";
    
    group.append("path")
        .attr("class", "panama-city-marker")
        .attr("d", starPath)
        .attr("transform", `translate(${x}, ${y}) scale(0.6)`)
        .attr("fill", "#FFD700")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "#2c3e50")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.8);
}

function setupZoom(mapId) {
    const map = maps[mapId];
    let zoomTimeout = null;
    
    map.zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on("zoom", function(event) {
            if (zoomTimeout) cancelAnimationFrame(zoomTimeout);
            zoomTimeout = requestAnimationFrame(() => {
                map.group.attr("transform", event.transform);
            });
        });
    
    map.svg.call(map.zoom);
}

function setupZoomControl(mapId) {
    d3.select(`#zoom-in-${mapId}`).on("click", () => {
        maps[mapId].svg.transition().duration(200).call(maps[mapId].zoom.scaleBy, 1.5);
    });
    
    d3.select(`#zoom-out-${mapId}`).on("click", () => {
        maps[mapId].svg.transition().duration(200).call(maps[mapId].zoom.scaleBy, 1 / 1.5);
    });
    
    d3.select(`#zoom-reset-${mapId}`).on("click", () => {
        maps[mapId].svg.transition().duration(300).call(maps[mapId].zoom.transform, d3.zoomIdentity);
    });
}

function setupProvinceDropdown() {
    if (!provincesData?.features) return;
    
    const select = d3.select("#province-select");
    select.html("");
    
    const provinceMap = new Map();
    municipalitiesData.features.forEach(feature => {
        const props = feature.properties;
        const codProv = props?.cod_prov || props?.cod_provincia;
        const nombProv = props?.nomb_prov || props?.nombre_provincia || "Unknown";
        
        if (codProv && !provinceMap.has(codProv)) {
            provinceMap.set(codProv, nombProv);
        }
    });
    
    const provinces = Array.from(provinceMap.entries())
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    
    provinces.forEach(prov => {
        select.append("option")
            .attr("value", prov.code)
            .text(prov.name);
    });
    
    const panamaProv = provinces.find(p => 
        p.name.toLowerCase().includes("panamá") || 
        p.name.toLowerCase().includes("panama")
    );
    
    if (panamaProv) {
        selectedProvince = panamaProv.code;
        select.property("value", panamaProv.code);
    } else if (provinces.length > 0) {
        selectedProvince = provinces[0].code;
        select.property("value", provinces[0].code);
    }
    
    select.on("change", function() {
        selectedProvince = this.value;
        dataCache.clear();
        if (currentView === 'province') {
            updateProvinceMap();
            updateProvinceChart();
        }
    });
}

function setupControls() {
    d3.select("#age-slider").on("input", function() {
        if (isPlaying) stopAutoPlay();
        currentAge = +this.value;
        d3.select("#age-value-large").text(currentAge);
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => updateAllMaps(), 50);
    });
    
    d3.selectAll(".tab-button").on("click", function() {
        const view = this.getAttribute("data-view");
        currentView = view;
        
        d3.selectAll(".tab-button").classed("active", false);
        d3.select(this).classed("active", true);
        d3.selectAll(".map-view").classed("active", false);
        
        if (view === 'total') {
            showTotalView();
        } else {
            showProvinceView();
        }
        
        dataCache.clear();
        updateAllMaps();
    });
    
    d3.selectAll(".sex-btn").on("click", function() {
        d3.selectAll(".sex-btn").classed("active", false);
        d3.select(this).classed("active", true);
        selectedSex = this.getAttribute("data-sex");
        dataCache.clear();
        updateAllMaps();
    });
    
    d3.select("#play-pause-btn").on("click", function() {
        const icon = d3.select("#play-icon");
        const button = d3.select(this);
        
        if (isPlaying) {
            stopAutoPlay();
            icon.text("▶");
            button.classed("playing", false);
        } else {
            startAutoPlay();
            icon.text("⏸");
            button.classed("playing", true);
        }
    });
    
    setupZoomControl('total');
    setupZoomControl('province');
}

function showTotalView() {
    d3.select("#map-container-single").classed("active", true);
    d3.select("#map-total").style("display", "block");
    d3.select("#map-container-single .zoom-controls").style("display", "flex");
    d3.select("#legend-total").style("display", "block");
    d3.select("#national-chart-container").style("display", "block");
    d3.select("#municipal-chart-container").style("display", "block");
    d3.select("#national-chart-container h3").text("National Activity Distribution");
    d3.select("#national-chart-container .instruction").text("Activity counts for the selected age across all of Panama");
    d3.select("#map-province").style("display", "none");
    d3.select("#map-container-province .zoom-controls").style("display", "none");
    d3.select("#legend-province").style("display", "none");
    d3.select(".province-controls").style("display", "none");
}

function showProvinceView() {
    d3.select("#map-container-province").classed("active", true);
    d3.select("#map-province").style("display", "block");
    d3.select("#map-container-province .zoom-controls").style("display", "flex");
    d3.select("#legend-province").style("display", "block");
    d3.select(".province-controls").style("display", "flex");
    d3.select("#national-chart-container").style("display", "block");
    d3.select("#municipal-chart-container").style("display", "block");
    d3.select("#map-total").style("display", "none");
    d3.select("#map-container-single .zoom-controls").style("display", "none");
    d3.select("#legend-total").style("display", "none");
    
    if (!selectedProvince && d3.select("#province-select").node().options.length > 0) {
        selectedProvince = d3.select("#province-select").node().value;
    }
}

function startAutoPlay() {
    if (isPlaying) return;
    isPlaying = true;
    
    playInterval = setInterval(() => {
        const slider = d3.select("#age-slider").node();
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        
        currentAge = currentAge >= max ? min : currentAge + 1;
        slider.value = currentAge;
        d3.select("#age-value-large").text(currentAge);
        
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => updateAllMaps(), 50);
    }, 500);
}

function stopAutoPlay() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
    isPlaying = false;
}

function updateAllMaps() {
    if (isUpdating) return;
    isUpdating = true;
    
    requestAnimationFrame(() => {
        try {
            if (currentView === 'total') {
                updateMap('total', selectedSex);
                updateNationalChart();
            } else {
                updateProvinceMap();
                updateProvinceChart();
            }
        } catch (error) {
            console.error("Error updating maps:", error);
        } finally {
            isUpdating = false;
        }
    });
}

function updateMap(mapId, sex) {
    const map = maps[mapId];
    if (!map?.group) return;
    
    if (mapId === 'total' && currentView !== 'total') return;
    if (mapId === 'province' && currentView !== 'province') return;
    
    const totals = getTotalsByFilters(currentAge, sex);
    const dataMap = new Map();
    totals.forEach(d => {
        const cod = String(d.cod_corr || d.c || '');
        if (cod) dataMap.set(cod, d);
    });
    
    const colorMap = new Map();
    municipalitiesData.features.forEach(feature => {
        const cod = String((feature.properties?.cod_corr) || '');
        if (cod) {
            const data = dataMap.get(cod);
            colorMap.set(cod, getColorForData(data));
        }
    });
    
    map.group.selectAll("path").each(function(d) {
        const cod = String((d.properties?.cod_corr) || '');
        d3.select(this).attr("fill", colorMap.get(cod) || activityColors.no_data);
    });
    
    map.dataMap = dataMap;
}

function updateProvinceMap() {
    if (!selectedProvince || currentView !== 'province') return;
    
    const map = maps.province;
    if (!map?.group) return;
    
    const provinceFeatures = municipalitiesData.features.filter(feature => {
        const props = feature.properties;
        const codProv = String(props?.cod_prov || props?.cod_provincia || '');
        return codProv === String(selectedProvince);
    });
    
    if (provinceFeatures.length === 0) return;
    
    const totals = getTotalsByFilters(currentAge, selectedSex);
    const dataMap = new Map();
    totals.forEach(d => {
        const cod = String(d.cod_corr || d.c || '');
        if (cod) dataMap.set(cod, d);
    });
    
    const provinceCollection = { type: "FeatureCollection", features: provinceFeatures };
    
    const padding = 40;
    const provinceMapHeight = CONFIG.mapHeight - 60;
    map.projection.fitSize(
        [CONFIG.mapWidth - padding * 2, provinceMapHeight - padding * 2],
        provinceCollection
    );
    
    const [tx, ty] = map.projection.translate();
    map.projection.translate([tx + padding, ty + padding]);
    map.path.projection(map.projection);
    
    map.group.selectAll("path").remove();
    
    const paths = map.group.selectAll("path")
        .data(provinceFeatures, d => String((d.properties?.cod_corr) || ''));
    
    paths.enter()
        .append("path")
        .attr("class", "municipality")
        .attr("d", map.path)
        .attr("stroke", "#bbb")
        .attr("stroke-width", 0.5)
        .attr("fill", function(d) {
            const cod = String((d.properties?.cod_corr) || '');
            const data = dataMap.get(cod);
            return getColorForData(data) || activityColors.no_data;
        })
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#2c3e50").attr("stroke-width", 1);
            showTooltip(event, d, 'province');
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "#bbb").attr("stroke-width", 0.5);
            hideTooltip('province');
        })
        .on("click", function(event, d) {
            selectMunicipality(d, 'province');
        });
    
    map.dataMap = dataMap;
    
    map.group.selectAll(".panama-city-marker").remove();
    addPanamaCityMarker(map.group, map.projection);
    
    map.svg.transition()
        .duration(300)
        .call(map.zoom.transform, d3.zoomIdentity);
}

function getTotalsByFilters(age, sex) {
    const cacheKey = `${age}_${sex}`;
    if (dataCache.has(cacheKey)) {
        return dataCache.get(cacheKey);
    }
    
    if (!ageIndexBuilt && aggregatedData.length > 0) {
        aggregatedData._ageIndex = new Map();
        aggregatedData.forEach((d, i) => {
            const ageField = d.a !== undefined ? d.a : d.age;
            if (ageField != null) {
                const ageVal = typeof ageField === 'string' ? parseInt(ageField, 10) : ageField;
                if (!isNaN(ageVal)) {
                    if (!aggregatedData._ageIndex.has(ageVal)) {
                        aggregatedData._ageIndex.set(ageVal, []);
                    }
                    aggregatedData._ageIndex.get(ageVal).push(i);
                }
            }
        });
        ageIndexBuilt = true;
    }
    
    const ageNum = typeof age === 'string' ? parseInt(age, 10) : age;
    const indices = aggregatedData._ageIndex?.get(ageNum) || [];
    
    const filtered = [];
    for (const idx of indices) {
        const d = aggregatedData[idx];
        const sexField = d.s !== undefined ? d.s : d.sexo;
        if (sex === 'all' || sexField === sex) {
            filtered.push(normalizeData(d));
        }
    }
    
    const grouped = new Map();
    filtered.forEach(d => {
        const cod = d.cod_corr;
        if (!grouped.has(cod)) {
            grouped.set(cod, {...d});
        } else {
            const existing = grouped.get(cod);
            existing.student += d.student;
            existing.student_worker += d.student_worker;
            existing.low_income_worker += d.low_income_worker;
            existing.high_income_worker += d.high_income_worker;
            existing.unemployed += d.unemployed;
            existing.inactive += d.inactive;
            existing.retired += d.retired;
            existing.total_count += d.total_count;
        }
    });
    
    const result = Array.from(grouped.values());
    dataCache.set(cacheKey, result);
    return result;
}

function normalizeData(d) {
    return {
        cod_corr: d.c || d.cod_corr || '',
        student: d.st || d.student || 0,
        student_worker: d.sw || d.student_worker || 0,
        low_income_worker: d.liw || d.low_income_worker || 0,
        high_income_worker: d.hiw || d.high_income_worker || 0,
        unemployed: d.u || d.unemployed || 0,
        inactive: d.i || d.inactive || 0,
        retired: d.r || d.retired || 0,
        total_count: d.tc || d.total_count || 0
    };
}

function getColorForData(data) {
    if (!data || data.total_count === 0) return activityColors.no_data;
    const dominant = getDominantActivity(data);
    return dominant ? dominant.color : activityColors.no_data;
}

function getDominantActivity(data) {
    const activities = {
        student: data.student || 0,
        student_worker: data.student_worker || 0,
        worker_low: data.low_income_worker || 0,
        worker_high: data.high_income_worker || 0,
        unemployed: data.unemployed || 0,
        inactive: data.inactive || 0,
        retired: data.retired || 0
    };
    
    let maxActivity = null;
    let maxCount = 0;
    
    for (const [name, count] of Object.entries(activities)) {
        if (count > maxCount) {
            maxCount = count;
            maxActivity = { name, count, color: activityColors[name] };
        }
    }
    
    return maxActivity;
}

function showTooltip(event, d, mapId) {
    try {
        const map = maps[mapId];
        const tooltip = d3.select(`#tooltip-${mapId}`);
        const [x, y] = d3.pointer(event, map.svg.node());
        
        const props = d.properties || {};
        const name = props.nomb_corr || props.nomb_dist || "Unknown";
        const cod = String(props.cod_corr || '');
        const data = map.dataMap?.get(cod);
        
        let content = `<h4>${name}</h4><div>Age: ${currentAge}</div>`;
        
        if (data && data.total_count > 0) {
            const activities = [
                { name: 'Students', count: data.student, color: activityColors.student },
                { name: 'Working Students', count: data.student_worker, color: activityColors.student_worker },
                { name: 'Workers (Low income)', count: data.low_income_worker, color: activityColors.worker_low },
                { name: 'Workers (High income)', count: data.high_income_worker, color: activityColors.worker_high },
                { name: 'Unemployed', count: data.unemployed, color: activityColors.unemployed },
                { name: 'Inactive', count: data.inactive, color: activityColors.inactive },
                { name: 'Retired', count: data.retired, color: activityColors.retired }
            ].filter(a => a.count > 0).sort((a, b) => b.count - a.count);
            
            content += `<div style="margin-top: 8px;"><strong>Total:</strong> ${data.total_count.toLocaleString()}</div>`;
            content += `<div style="margin-top: 8px; font-size: 0.9em;">`;
            activities.forEach(a => {
                const pct = ((a.count / data.total_count) * 100).toFixed(1);
                content += `<div style="margin: 3px 0;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: ${a.color}; margin-right: 5px;"></span>
                    ${a.name}: <strong>${pct}%</strong>
                </div>`;
            });
            content += `</div>`;
        }
        
        tooltip.html(content)
        .style("left", (x + 10) + "px")
        .style("top", (y + 10) + "px")
        .classed("show", true);
    } catch (error) {
        console.error("Error showing tooltip:", error);
    }
}

function hideTooltip(mapId) {
    d3.select(`#tooltip-${mapId}`).classed("show", false);
}

function selectMunicipality(d, mapId) {
    if (isPlaying) {
        stopAutoPlay();
        d3.select("#play-icon").text("▶");
        d3.select("#play-pause-btn").classed("playing", false);
    }
    
    const map = maps[mapId];
    const cod = String((d.properties?.cod_corr) || '');
    let data = map.dataMap?.get(cod);
    
    if (!data) {
        const totals = getTotalsByFilters(currentAge, selectedSex);
        data = totals.find(t => String(t.cod_corr || t.c || '') === cod);
    }
    
    updateActivityChart(d.properties, data);
    
    if (currentView === 'total') {
        updateNationalChart();
    } else if (currentView === 'province') {
        updateProvinceChart();
    }
}

function updateNationalChart() {
    const container = d3.select("#national-activity-chart");
    
    try {
        const totals = getTotalsByFilters(currentAge, selectedSex);
        
        if (!totals || totals.length === 0) {
            container.html(`<div style="padding: 20px; text-align: center; color: #7f8c8d;">No data available</div>`);
            return;
        }
        
        const national = {
            student: 0, student_worker: 0, low_income_worker: 0,
            high_income_worker: 0, unemployed: 0, inactive: 0, retired: 0, total_count: 0
        };
        
        totals.forEach(d => {
            national.student += d.student;
            national.student_worker += d.student_worker;
            national.low_income_worker += d.low_income_worker;
            national.high_income_worker += d.high_income_worker;
            national.unemployed += d.unemployed;
            national.inactive += d.inactive;
            national.retired += d.retired;
            national.total_count += d.total_count;
        });
        
        if (national.total_count === 0) {
            container.html(`<div style="padding: 20px; text-align: center; color: #7f8c8d;">No data available</div>`);
            return;
        }
        
        renderChart(container, national, "National Activity Distribution", 
            "Activity counts for the selected age across all of Panama");
    } catch (error) {
        console.error("Error updating national chart:", error);
    }
}

function updateProvinceChart() {
    const container = d3.select("#national-activity-chart");
    
    if (!selectedProvince) {
        container.html(`<div style="padding: 20px; text-align: center; color: #7f8c8d;">Select a province</div>`);
        return;
    }
    
    try {
        const provinceName = d3.select("#province-select").node().options[d3.select("#province-select").node().selectedIndex]?.text || "Selected Province";
        
        const totals = getTotalsByFilters(currentAge, selectedSex);
        const provinceMunicipalities = municipalitiesData.features.filter(feature => {
            const props = feature.properties;
            const codProv = String(props?.cod_prov || props?.cod_provincia || '');
            return codProv === String(selectedProvince);
        });
        
        const provinceCodes = new Set(provinceMunicipalities.map(f => String(f.properties?.cod_corr || '')));
        
        const province = {
            student: 0, student_worker: 0, low_income_worker: 0,
            high_income_worker: 0, unemployed: 0, inactive: 0, retired: 0, total_count: 0
        };
        
        totals.forEach(d => {
            const cod = String(d.cod_corr || d.c || '');
            if (provinceCodes.has(cod)) {
                province.student += d.student;
                province.student_worker += d.student_worker;
                province.low_income_worker += d.low_income_worker;
                province.high_income_worker += d.high_income_worker;
                province.unemployed += d.unemployed;
                province.inactive += d.inactive;
                province.retired += d.retired;
                province.total_count += d.total_count;
            }
        });
        
        if (province.total_count === 0) {
            container.html(`<div style="padding: 20px; text-align: center; color: #7f8c8d;">No data available for ${provinceName}</div>`);
            return;
        }
        
        d3.select("#national-chart-container h3").text(`${provinceName} Activity Distribution`);
        d3.select("#national-chart-container .instruction").text(`Activity counts for the selected age in ${provinceName}`);
        
        renderChart(container, province, `${provinceName} Activity Distribution`, 
            `Activity counts for the selected age in ${provinceName}`);
    } catch (error) {
        console.error("Error updating province chart:", error);
    }
}

function renderChart(container, data, title, instruction) {
    const sexLabel = selectedSex === 'all' ? 'All' : selectedSex === 'Hombre' ? 'Male' : 'Female';
    const activities = [
        { name: 'Students', count: data.student, color: activityColors.student },
        { name: 'Working Students', count: data.student_worker, color: activityColors.student_worker },
        { name: 'Workers (Low income)', count: data.low_income_worker, color: activityColors.worker_low },
        { name: 'Workers (High income)', count: data.high_income_worker, color: activityColors.worker_high },
        { name: 'Unemployed', count: data.unemployed, color: activityColors.unemployed },
        { name: 'Inactive', count: data.inactive, color: activityColors.inactive },
        { name: 'Retired', count: data.retired, color: activityColors.retired }
    ].filter(a => a.count > 0).sort((a, b) => b.count - a.count);
    
    let html = `<div style="padding: 15px;">
        <p style="color: #7f8c8d; margin-bottom: 15px;">Age ${currentAge} • ${sexLabel} • Total: ${data.total_count.toLocaleString()}</p>
        <div style="margin-top: 15px;">`;
    
    activities.forEach(a => {
        const pct = ((a.count / data.total_count) * 100).toFixed(1);
        const width = (a.count / data.total_count) * 100;
        html += `<div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 0.9em;">
                <span>${a.name}</span>
                <span style="color: #7f8c8d;">${a.count.toLocaleString()} (${pct}%)</span>
            </div>
            <div style="background: #ecf0f1; height: 18px; border-radius: 3px;">
                <div style="background: ${a.color}; height: 100%; width: ${width}%; transition: width 0.3s;"></div>
            </div>
        </div>`;
    });
    
    html += `</div></div>`;
    container.html(html);
}

function updateActivityChart(properties, data) {
    const container = d3.select("#activity-chart");
    const name = properties.nomb_corr || properties.nomb_dist || "Unknown";
    
    if (!data) {
        container.html(`<div style="padding: 20px; text-align: center; color: #7f8c8d;">
            <p>Selected: <strong>${name}</strong></p>
            <p style="margin-top: 10px;">No data available for this municipality</p>
        </div>`);
        return;
    }
    
    const totalCount = data.total_count || 0;
    if (totalCount === 0) {
        container.html(`<div style="padding: 20px; text-align: center; color: #7f8c8d;">
            <p>Selected: <strong>${name}</strong></p>
            <p style="margin-top: 10px;">No data available</p>
        </div>`);
        return;
    }
    
    const activities = [
        { name: 'Students', count: data.student || 0, color: activityColors.student },
        { name: 'Working Students', count: data.student_worker || 0, color: activityColors.student_worker },
        { name: 'Workers (Low income)', count: data.low_income_worker || 0, color: activityColors.worker_low },
        { name: 'Workers (High income)', count: data.high_income_worker || 0, color: activityColors.worker_high },
        { name: 'Unemployed', count: data.unemployed || 0, color: activityColors.unemployed },
        { name: 'Inactive', count: data.inactive || 0, color: activityColors.inactive },
        { name: 'Retired', count: data.retired || 0, color: activityColors.retired }
    ].filter(a => a.count > 0).sort((a, b) => b.count - a.count);
    
    let html = `<div style="padding: 20px;">
        <h3 style="margin-bottom: 15px;">${name}</h3>
        <p style="color: #7f8c8d; margin-bottom: 15px;">Age ${currentAge} • Total: ${totalCount.toLocaleString()}</p>
        <div>`;
    
    activities.forEach(a => {
        const pct = ((a.count / totalCount) * 100).toFixed(1);
        const width = (a.count / totalCount) * 100;
        html += `<div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: 500;">${a.name}</span>
                <span style="color: #7f8c8d;">${a.count.toLocaleString()} (${pct}%)</span>
            </div>
            <div style="background: #ecf0f1; height: 20px; border-radius: 3px;">
                <div style="background: ${a.color}; height: 100%; width: ${width}%;"></div>
        </div>
        </div>`;
    });
    
    html += `</div></div>`;
    container.html(html);
}

function initializeLegend(selector) {
    const legendData = [
        { name: 'Students', color: activityColors.student },
        { name: 'Working Students', color: activityColors.student_worker },
        { name: 'Workers (Low income)', color: activityColors.worker_low },
        { name: 'Workers (High income)', color: activityColors.worker_high },
        { name: 'Unemployed', color: activityColors.unemployed },
        { name: 'Inactive', color: activityColors.inactive },
        { name: 'Retired', color: activityColors.retired },
        { name: 'No Data', color: activityColors.no_data },
        { name: 'Panama City', isStar: true }
    ];
    
    const legendItems = d3.select(selector).select(".legend-items")
        .selectAll(".legend-item")
        .data(legendData)
        .enter()
        .append("div")
        .attr("class", "legend-item");
    
    legendItems.each(function(d) {
        const item = d3.select(this);
        if (d.isStar) {
            const starPath = "M 0,-8 L 2,-2.5 L 8,-2.5 L 3.5,0.5 L 5,6 L 0,3 L -5,6 L -3.5,0.5 L -8,-2.5 L -2.5,-2.5 Z";
            const symbol = item.append("span")
                .attr("class", "legend-symbol");
            symbol.append("svg")
                .attr("width", "16")
                .attr("height", "16")
                .attr("viewBox", "-8 -8 16 16")
                .append("path")
                .attr("d", starPath)
                .attr("fill", "#FFD700")
                .attr("stroke", "#2c3e50")
                .attr("stroke-width", "1");
        } else {
            item.append("span")
                .attr("class", "legend-color")
                .style("background", d.color);
        }
        item.append("span").text(d.name);
    });
}

function showError(message) {
    d3.select("#maps-wrapper").append("div")
        .style("padding", "20px")
        .style("color", "red")
        .style("text-align", "center")
        .html(`<p>${message}</p>`);
}
