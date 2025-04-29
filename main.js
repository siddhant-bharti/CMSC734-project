import {loadDataSet, createCountryISOMapping} from "./data-utils.js";

var map = d3.select('#map');
var mapWidth = +map.attr('width');
var mapHeight = +map.attr('height');
var vertices = d3.map();
var activeMapType = 'nodes_links';
var nodeFeatures = [];
var countryToLayer = new Map();

var myMap = L.map('map').setView([0, 0], 2);
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
// {
//     maxZoom: 10,
//     minZoom: 3,
//     attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
// }).addTo(myMap);
L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 2,
	maxZoom: 10,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
}).addTo(myMap);

var svgLayer = L.svg();
svgLayer.addTo(myMap)
var svg = d3.select('#map').select('svg');
var nodeLinkG = svg.select('g')
.attr('class', 'leaflet-zoom-hide');

// Arrow head
svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 6)  
    .attr("refY", 5)
    .attr("markerWidth", 2)  
    .attr("markerHeight", 2)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 Z") 
    .attr("fill", "black");

// For curves in migration paths
let randomOffset = Math.random() * 100 - 50;

// Global variable for the data
var global_data;
var filtered_data;
var sankey_filtered_data;

// Years
var maxYear;  // stores max year of the dataset
var minYear;  // stores mins year of the dataset
var startYear;  // store start year for the filter
var endYear;  // store end year for the filter
var originCountry = "NONE";  // store origin
var originCountryLayer = "NONE";
var destinationCountry = "NONE";  // store origin
var destinationCountryLayer = "NONE";
var originRegion = "NONE";
var destinationRegion = "NONE";
var originRegionLayer = "NONE";
var destinationRegionLayer = "NONE";
var showRegionPie = false;
var showRegionBar = false;

// some mapping
var countryToIso;
var isoToCountry;
var asylumToRegion = new Map();
var regionToCountries = new Map();


// Coordinates for regions
var regionCoordinates = {
    'Europe': [51.0, 10.0], 
    'Southern Africa': [-28.8166236, 24.991639], 
    'Asia and the Pacific': [14.440122, 120.5511622],
    'Middle East and North Africa': [33.8746648, 35.5667363],
    'East and Horn of Africa, and Great Lakes': [57.719512, 11.94776],
    'West and Central Africa': [14.6617324, -17.4372164],
    'Americas': [39.7837304, -100.445882]
}
// Used for Bubble chart
var regionCoordinates2D = {
    'Europe': [51.0, 20.0], 
    'Southern Africa': [-28.8166236, 24.991639], 
    'Asia and the Pacific': [14.440122, 120.5511622],
    'Middle East and North Africa': [33.8746648, 35.5667363],
    'East and Horn of Africa, and Great Lakes': [57.719512, 11.94776],
    'West and Central Africa': [14.6617324, -17.4372164],
    'Americas': [19.7837304, -100.445882]
}

let geojson;

Promise.all([
    d3.csv('./datasets/dataset_denormalized_enriched_pruned.csv', function(row) {
        var link = {origin: row['originName'], originCoord: [+row['originLatitude'], +row['originLongitude']], destination: row['asylumName'], destinationCoord: [+row['asylumLatitude'], +row['asylumLongitude']], 
            destinationRegion: row['AsylumRegion'], migrantCount: +row[' Count'].replace(/,/g, '').trim(), year: +row['Year'], OriginISO: row['OriginISO'], AsylumISO: row['AsylumISO']};
        return link; 
    })   
]).then(function(data) {
    global_data = data;
    filtered_data = data;
    sankey_filtered_data = data;
    maxYear = d3.max(data[0], d => d.year);
    minYear = d3.min(data[0], d => d.year);
    startYear = minYear;
    endYear = maxYear;
    const mappings = createCountryISOMapping(data[0]);
    countryToIso = mappings.countryToIso; 
    isoToCountry = mappings.isoToCountry;
    global_data[0].forEach(row => {
        asylumToRegion.set(row.destination, row.destinationRegion); 
        if(!regionToCountries.has(row.destinationRegion)){
            regionToCountries.set(row.destinationRegion, new Array());
        }
        if(!regionToCountries.get(row.destinationRegion).includes(row.destination)){
            regionToCountries.get(row.destinationRegion).push(row.destination);
        }
    });

    // Add GeoJSON data to the main map
    loadGeoJSON();

    applyFilter();
    drawSlider();
    addPlayButton();
    originDropDown();
    originCheckBox();
    destinationDropDown();
    drawVisualizations();
});

function loadGeoJSON(){
    if(geojson){
        myMap.removeLayer(geojson);
    }
    fetch('countries.geo.json')
    .then(response => response.json())
    .then(data => {
        geojson = L.geoJson(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(myMap);
    })
    .catch(error => {
        console.error('Error loading GeoJSON on the Main Map:', error);
    });
}

function doDrawSankey() {
    if (originCountry === "NONE" && destinationCountry === "NONE") {
        return false;
    } else if (originCountry !== "NONE" && destinationCountry !== "NONE") {
        return false;
    }
    return true;
}

function doDrawRegions() {
    return showRegionPie;
}

function drawVisualizations() {
    drawFlowMap();
    drawBarChart();
    drawSankeyDiagram();
    drawRegionPieChart();
    enableDisableDropDowns();
}

function drawSlider() {
    var slider_min_year = new Date(minYear, 0, 1);
    var slider_max_year = new Date(maxYear, 0, 1);
    var sliderRange = d3
        .sliderBottom()
        .min(slider_min_year)
        .max(slider_max_year)
        .width(300)
        .tickFormat(d3.timeFormat('%Y'))
        .ticks(8)
        .default([slider_min_year, slider_max_year])
        .fill('blue');

    sliderRange.on('onchange', val => {
        const startDate = new Date(val[0]);
        const endDate = new Date(val[1]);

        startYear = startDate.getFullYear();
        endYear = endDate.getFullYear();
        applyFilter();
        drawVisualizations();
    });
    
    const gRange =d3.select('#slider-range');
    
    gRange.call(sliderRange);

}

function originDropDown() {
    const options = ["NONE"];

    Object.keys(countryToIso).sort().forEach(country => {
        options.push(country);
    });

    const dropdown = d3.select("#origin-drop-down");

    dropdown.selectAll("option")
    .data(options)
    .enter()
    .append("option")
    .text(d => d)
    .attr("value", d => d);

    dropdown.on("change", function () {
    const selectedValue = d3.select(this).property("value");
        handleDropdownChange(selectedValue);
    });

    function handleDropdownChange(value) {
        originCountry = value;
        // Remove selection from map when using drop down
        resetHighlightFixed(originCountryLayer);
        resetHighlightFixed(destinationCountryLayer);
        applyFilter();
        drawVisualizations();
    }
}

function setOriginDropDown(value) {
    d3.select("#origin-drop-down")
    .property("value", value)
    .dispatch("change");
}

function destinationDropDown() {
    const options = ["NONE"];

    Object.keys(countryToIso).sort().forEach(country => {
        options.push(country);
    });

    const dropdown = d3.select("#destination-drop-down");

    dropdown.selectAll("option")
    .data(options)
    .enter()
    .append("option")
    .text(d => d)
    .attr("value", d => d);

    dropdown.on("change", function () {
    const selectedValue = d3.select(this).property("value");
        handleDropdownChange(selectedValue);
    });

    function handleDropdownChange(value) {
        destinationCountry = value;
        // Remove selection from map when using drop down
        resetHighlightFixed(originCountryLayer);
        resetHighlightFixed(destinationCountryLayer);
        // Show visualization
        applyFilter();
        drawVisualizations();
    }
}

function setDestinationDropDown(value) {
    d3.select("#destination-drop-down")
    .property("value", value)
    .dispatch("change");
}

function enableDisableDropDowns() {
    if (showRegionPie) {
        d3.select("#origin-drop-down").attr("disabled", true);
        d3.select("#destination-drop-down").attr("disabled", true);
    } else {
        d3.select("#origin-drop-down").attr("disabled", null);
        d3.select("#destination-drop-down").attr("disabled", null);
    }
}

function applyFilter() {

    const parseYear = d3.timeParse("%Y");
    const startDate = parseYear(startYear.toString());
    const endDate = parseYear(endYear.toString());
    filtered_data = global_data.slice();
    sankey_filtered_data = global_data.slice();

    //TODO: Filter should be optional on the provision of origin/destination

    // For map, bar
    filtered_data[0] = filtered_data[0].filter(d => {
        const yearDate = parseYear(d.year);
        if (originCountry === "NONE" && destinationCountry === "NONE") {
            return false;
        } else if (destinationCountry === "NONE"){
            return (d.origin === originCountry && yearDate >= startDate && yearDate <= endDate);
        } else if (originCountry === "NONE"){
            return (d.destination === destinationCountry && yearDate >= startDate && yearDate <= endDate);
        } else {
            return (d.origin === originCountry && d.destination === destinationCountry && yearDate >= startDate && yearDate <= endDate);
        }
    });
    //For sankey
    sankey_filtered_data[0] = sankey_filtered_data[0].filter(d => {
        const yearDate = parseYear(d.year);
        if (originCountry === "NONE" && destinationCountry === "NONE") {
            return true;
        } else if (destinationCountry === "NONE"){
            return (d.origin === originCountry && yearDate >= startDate && yearDate <= endDate);
        } else if (originCountry === "NONE"){
            return (d.destination === destinationCountry && yearDate >= startDate && yearDate <= endDate);
        } else {
            return (d.origin === originCountry && d.destination === destinationCountry && yearDate >= startDate && yearDate <= endDate);
        }
    });
}

function drawFlowMap() {
    var filteredLinks = filtered_data[0];

    const maxMigrantCount = d3.max(filteredLinks, d => d.migrantCount);
    const minMigrantCount = d3.min(filteredLinks, d => d.migrantCount);
    const thicknessScale = d3.scaleLinear().domain([minMigrantCount, maxMigrantCount]).range([1, 10]);

    nodeLinkG.selectAll('.grid-link').remove();

    nodeLinkG.selectAll('.grid-link')
    .data(filteredLinks)
    .enter().append('path')
    .attr('class', 'grid-link')
    .style('stroke', '#999')
    .style('stroke-opacity', 0.5)
    .style('fill', 'none')
    .style('stroke-width', function(d){ return thicknessScale(d.migrantCount) })      

    myMap.on('zoomend', updateLayers);
    updateLayers();
}

function updateLayers() {
    nodeLinkG.selectAll('.grid-link')
    .attr('d', function(d) {
        let origin = myMap.latLngToLayerPoint(d.originCoord);
        let destination = myMap.latLngToLayerPoint(d.destinationCoord);
        
        let controlPoint = [
            (origin.x + destination.x) / 2,
            Math.min(origin.y, destination.y) + randomOffset
        ];
        
        let line = d3.line()
            .x(d => d[0])
            .y(d => d[1])
            .curve(d3.curveBasis);
            
        let points = [[origin.x, origin.y], controlPoint, [destination.x, destination.y]];
        
        return line(points);
    })
    .attr("marker-end", "url(#arrowhead)");
    // .attr('x1', function(d){return myMap.latLngToLayerPoint(d.origin).x})
    // .attr('y1', function(d){return myMap.latLngToLayerPoint(d.origin).y})
    // .attr('x2', function(d){return myMap.latLngToLayerPoint(d.destination).x})
    // .attr('y2', function(d){return myMap.latLngToLayerPoint(d.destination).y});
}

function drawSankeyDiagram() {
    const rawData = sankey_filtered_data[0];
    const nodeNames = Array.from(
        new Set(rawData.flatMap(d => {
            if (doDrawRegions()){
                const entries = [d.destinationRegion + "_d"];
                if (asylumToRegion.has(d.origin)) {
                    entries.push(asylumToRegion.get(d.origin) + "_o");
                }
                return entries;
            } else {
                const entries = [d.origin, d.destination];
                if (destinationCountry === "NONE") {
                    entries.push(d.destinationRegion);
                } else if (originCountry === "NONE" && asylumToRegion.has(d.origin)) {
                    entries.push(asylumToRegion.get(d.origin));
                } 
                return entries;
            }
        }))
    );
    const nodes = nodeNames.map((name, index) => ({ name, index }));
    const nodeIndexMap = new Map(nodes.map(n => [n.name, n.index]));
    const linkMap = new Map();
    if (doDrawRegions()) {
        rawData.forEach(d => {
            if (asylumToRegion.has(d.origin)) {
                const originRegionIdx = nodeIndexMap.get(asylumToRegion.get(d.origin) + "_o");
                const destinationRegionIdx = nodeIndexMap.get(d.destinationRegion + "_d");
                const key = `${originRegionIdx}->${destinationRegionIdx}`;
                if (!linkMap.has(key)) {
                    linkMap.set(key, { source: originRegionIdx, target: destinationRegionIdx, value: 0 });
                }
                linkMap.get(key).value += d.migrantCount;
            }
        });
    } else {
        if (destinationCountry === "NONE") {
            rawData.forEach(d => {
                const originIdx = nodeIndexMap.get(d.origin);
                const regionIdx = nodeIndexMap.get(d.destinationRegion);
                const destIdx = nodeIndexMap.get(d.destination);
                const key1 = `${originIdx}->${regionIdx}`;
                const key2 = `${regionIdx}->${destIdx}`;
                if (!linkMap.has(key1)) {
                    linkMap.set(key1, { source: originIdx, target: regionIdx, value: 0 });
                }
                linkMap.get(key1).value += d.migrantCount;
                if (!linkMap.has(key2)) {
                    linkMap.set(key2, { source: regionIdx, target: destIdx, value: 0 });
                }
                linkMap.get(key2).value += d.migrantCount;
            });
        } else if (originCountry === "NONE") {
            rawData.forEach(d => {
                const originIdx = nodeIndexMap.get(d.origin);
                if (asylumToRegion.has(d.origin)) {
                    const regionIdx = nodeIndexMap.get(asylumToRegion.get(d.origin));
                    const destIdx = nodeIndexMap.get(d.destination);
                    const key1 = `${originIdx}->${regionIdx}`;
                    const key2 = `${regionIdx}->${destIdx}`;
                    if (!linkMap.has(key1)) {
                        linkMap.set(key1, { source: originIdx, target: regionIdx, value: 0 });
                    }
                    linkMap.get(key1).value += d.migrantCount;
                    if (!linkMap.has(key2)) {
                        linkMap.set(key2, { source: regionIdx, target: destIdx, value: 0 });
                    }
                    linkMap.get(key2).value += d.migrantCount;
                } else {
                    const destIdx = nodeIndexMap.get(d.destination);
                    const key = `${originIdx}->${destIdx}`;
                    if (!linkMap.has(key)) {
                        linkMap.set(key, { source: originIdx, target: destIdx, value: 0 });
                    }
                    linkMap.get(key).value += d.migrantCount;
                }
            });
        }
    }
    const links = Array.from(linkMap.values());

    d3.select("#sankey").select("svg").remove();

    if (doDrawSankey() || doDrawRegions()){
        var color = d3.scaleOrdinal(d3.schemeCategory10);

        var margin = {top: 10, right: 10, bottom: 10, left: 10},
        width = 390 - margin.left - margin.right,
        height = 1500 - margin.top - margin.bottom;

        var svg = d3.select("#sankey").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform","translate(" + margin.left + "," + margin.top + ")");

        var sankey = d3.sankey()
        .nodeWidth(15)
        .nodePadding(8)
        .size([width, height]);

        sankey
        .nodes(nodes)
        .links(links)
        .layout(1);

        var link = svg.append("g")
        .selectAll(".link")
        .data(links)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", sankey.link() )
        .style("stroke-width", function(d) { return Math.max(1, d.dy); })
        .sort(function(a, b) { return b.dy - a.dy; });

        var node = svg.append("g")
        .selectAll(".node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
        .call(d3.drag()
        .subject(function(d) { return d; })
        .on("start", function() { this.parentNode.appendChild(this); })
        .on("drag", dragmove));

        node
        .append("rect")
        .attr("height", function(d) { return d.dy; })
        .attr("width", sankey.nodeWidth())
        .style("fill", function(d) { return d.color = color(d.name.replace(/ .*/, "")); })
        .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
        .append("title")
        .text(function(d) { return d.name + "\n" + "There is " + d.value + " stuff in this node"; });

        node
        .append("text")
        .attr("x", -6)
        .attr("y", function(d) { return d.dy / 2; })
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .attr("transform", null)
        .text(function(d) { 
            if(doDrawRegions()){
                return d.name.slice(0,-2);
            }else{
                return d.name;
            }
        })
        .filter(function(d) { return d.x < width / 2; })
        .attr("x", 6 + sankey.nodeWidth())
        .attr("text-anchor", "start");

        function dragmove(d) {
            d3.select(this)
            .attr("transform",
                    "translate("
                    + d.x + ","
                    + (d.y = Math.max(
                        0, Math.min(height - d.dy, d3.event.y))
                        ) + ")");
            sankey.relayout();
            link.attr("d", sankey.link() );
        }
    }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const saturation = 70 + (Math.abs(hash) % 20);
    const lightness = 50 + (Math.abs(hash) % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function drawBarChart() {
    var links = filtered_data[0];
    const width = 400;
    const height = 600;
    const margin = { top: 30, right: 30, bottom: 30, left: 30 };
    const barHeight = 25;
    const totalsByDestination = {};


    if (showRegionBar === true)
    {
        // console.log("Region Out");
        if (originCountry !== "NONE") {
            links.forEach(d => {
                if (!totalsByDestination[d.destination]) {
                    totalsByDestination[d.destination] = { migrantCount: 0, AsylumISO: d.AsylumISO };
                }
                totalsByDestination[d.destination].migrantCount += d.migrantCount;
            });
        } else {
            links.forEach(d => {
                if (!totalsByDestination[d.origin]) {
                    totalsByDestination[d.origin] = { migrantCount: 0, AsylumISO: d.OriginISO };
                }
                totalsByDestination[d.origin].migrantCount += d.migrantCount;
            });
        }

    } else {
        if (originCountry !== "NONE") {
            links.forEach(d => {
                if (!totalsByDestination[d.destination]) {
                    totalsByDestination[d.destination] = { migrantCount: 0, AsylumISO: d.AsylumISO };
                }
                totalsByDestination[d.destination].migrantCount += d.migrantCount;
            });
        } else {
            links.forEach(d => {
                if (!totalsByDestination[d.origin]) {
                    totalsByDestination[d.origin] = { migrantCount: 0, AsylumISO: d.OriginISO };
                }
                totalsByDestination[d.origin].migrantCount += d.migrantCount;
            });
        }
    }
    
    
    
    // Now map into a clean array
    const data = Object.entries(totalsByDestination).map(([destination, info]) => ({
        destination,
        migrantCount: info.migrantCount,
        AsylumISO: info.AsylumISO
    }));

    const sorteddata = data.sort((a, b) => b.migrantCount - a.migrantCount);
    
    const scrollableHeight = sorteddata.length * barHeight + margin.top + margin.bottom;

    // More Dynamic.
    let svg = d3.select("#bar").select("svg");
    if (svg.empty()) {
        svg = d3.select("#bar")
            .append("svg")
            .attr("width", width);
    }
    svg.attr("height", scrollableHeight);


    const x = d3.scaleLinear()
        .domain([0, d3.max(sorteddata, d => d.migrantCount)])
        .nice()
        .range([margin.right, width - margin.left]);

    const xlabel = d3.scaleLinear()
        .domain([0, d3.max(sorteddata, d => d.migrantCount)])
        .nice()
        .range([50, width - margin.left]);

    const y = d3.scaleBand()
        .domain(sorteddata.map(d => d.destination))
        .range([margin.left, width - margin.right])
        .padding(0.1);
    
    const bars = svg.selectAll("rect").data(sorteddata, d => d.destination);

    // ENTER
    const barsEnter = bars.enter()
        .append("rect")
        .attr("x", 50)
        .attr("y", (d, i) => margin.top + i * barHeight)
        .attr("height", barHeight - 1)
        .attr("width", 0)
        .attr("fill", d => stringToColor(d.AsylumISO))
        .transition()
        .duration(500)
        .attr("width", d => xlabel(d.migrantCount) - xlabel(0));   // <<<<<< use xlabel here

    
    // UPDATE
    bars.transition()
        .duration(500)
        .attr("y", (d, i) => margin.top + i * barHeight)
        .attr("width", d => xlabel(d.migrantCount) - x(0));
    
    // EXIT
    bars.exit()
        .transition()
        .duration(300)
        .attr("width", 0)
        .remove();
    
    // Bind data for labels
    const labels = svg.selectAll("text.bar-label")
        .data(sorteddata, d => d.destination);

    // ENTER
    labels.enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", 45)
        .attr("y", (d, i) => margin.top + i * barHeight + (barHeight / 2))
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("fill", "black")
        .style("font-size", "10px")
        .text(d => {
            return d.destination;
        })
        .transition()
        .duration(500)
        .style("opacity", 1);

    // UPDATE
    labels.transition()
        .duration(500)
        .attr("y", (d, i) => margin.top + i * barHeight + (barHeight / 2))
        .text(d => d.destination);

    // EXIT
    labels.exit()
        .transition()
        .duration(300)
        .style("opacity", 0)
        .remove();

    // Select the existing axis or append it if missing
    let xAxisGroup = svg.select("g.x-axis");

    if (xAxisGroup.empty()) {
        // First time: create the axis group
        xAxisGroup = svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${margin.top - 5})`);
    }
    
    // Whether first time or updating: transition and update axis properly
    xAxisGroup.transition()
        .duration(500)
        .call(d3.axisTop(xlabel).ticks(5));
    
    // Optional: update label style after axis is called
    xAxisGroup.selectAll("text")
        .style("font-size", "10px");
    

    svg.selectAll("text.bar-textlabel").remove();
    // Show immigration number on each bar.
    const numberlabels = svg.selectAll("text.bar-textlabel").data(sorteddata, d => d.destination);
    // numberlabels.exit()
    //             .remove();

    // ENTER labels
    numberlabels.enter()
        .append("text")
        .attr("class", "bar-textlabel")
        .attr("x", d => 55)
        .attr("y", (d, i) => margin.top + i * barHeight + (barHeight / 2))
        .attr("dy", ".35em")
        .attr("fill", "black")
        .attr("font-size", "12px")
        .text(d => d.migrantCount)
        .style("opacity", 0)
        .transition()
        .duration(50)
        .style("opacity", 1);
    
    // UPDATE labels
    numberlabels.transition()
        .duration(50)
        .attr("x", d => 55)
        .attr("y", (d, i) => margin.top + i * barHeight + (barHeight / 2))
        .text(d => d.migrantCount);
    
    // EXIT labels
    numberlabels.exit()
        .transition()
        .duration(10)
        .style("opacity", 0)
        .remove();
}

// Country selection logic is inspired from (syntax)
// https://medium.com/@limeira.felipe94/highlighting-countries-on-a-map-with-leaflet-f84b7efee0a9

function style(feature) {
    return {
        fillColor: 'gray',
        weight: 1,
        opacity: 1,
        color: 'black',
        fillOpacity: 0.0
    };
}


function highlightFeature(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 5,
        color: 'red',
        fillColor: 'red',
        dashArray: '',
        fillOpacity: 0.5
    });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}

function highlightFeatureRegion(e){
    var parentLayer = e.target;
    const parentISO = parentLayer.feature.id;
    const parentRegion = asylumToRegion.get(isoToCountry[parentISO]);
    if(regionToCountries.has(parentRegion)){
        const countryList = regionToCountries.get(parentRegion);
        countryList.forEach(countryName => {
            const countryISO = countryToIso[countryName];
            if(countryToLayer.has(countryISO)){
                const countryLayer = countryToLayer.get(countryISO);
                highlightFeatureFixed(countryLayer);
            }
        });
    }
}

function resetHighlight(e) {
    var layer = e.target;
    try {
        if (layer !== originCountryLayer && layer !== destinationCountryLayer) {
            geojson.resetStyle(layer);
        }
    } catch (error) {
        console.log(error);
    }
}

function resetHighlightRegion(e){
    var parentLayer = e.target;
    try {
        if (parentLayer !== originRegionLayer && parentLayer !== destinationRegionLayer) {
            const parentISO = parentLayer.feature.id;
            const parentRegion = asylumToRegion.get(isoToCountry[parentISO]);
            if(regionToCountries.has(parentRegion)){
                const countryList = regionToCountries.get(parentRegion);
                countryList.forEach(countryName => {
                    const countryISO = countryToIso[countryName];
                    if(countryToLayer.has(countryISO)){
                        const countryLayer = countryToLayer.get(countryISO);
                        geojson.resetStyle(countryLayer);
                    }
                });
            }
        }
    } catch (error) {
        console.log(error);
    }
}

function highlightFeatureFixed(layer) {
    layer.setStyle({
        weight: 5,
        color: 'red',
        fillColor: 'red',
        dashArray: '',
        fillOpacity: 0.5
    });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}

function highlightFeatureFixedRegion(parentLayer){
    const parentISO = parentLayer.feature.id;
    const parentRegion = asylumToRegion.get(isoToCountry[parentISO]);
    if(regionToCountries.has(parentRegion)){
        const countryList = regionToCountries.get(parentRegion);
        countryList.forEach(countryName => {
            const countryISO = countryToIso[countryName];
            if(countryToLayer.has(countryISO)){
                const countryLayer = countryToLayer.get(countryISO);
                highlightFeatureFixed(countryLayer);
            }
        });
    }
}

function resetHighlightFixed(layer) {
    try {
        geojson.resetStyle(layer);
    } catch (error) {
        console.log(error);
    }
}

function resetHighlightFixedRegion(parentLayer){
    const parentISO = parentLayer.feature.id;
    const parentRegion = asylumToRegion.get(isoToCountry[parentISO]);
    const countryList = regionToCountries.get(parentRegion);
    countryList.forEach(countryName => {
        const countryISO = countryToIso[countryName];
        if(countryToLayer.has(countryISO)){
            const countryLayer = countryToLayer.get(countryISO);
            resetHighlightFixed(countryLayer);
        }
    });
}

function selectCountry(e) {
    const layer = e.target;

    // console.log('Clicked country:', countryName);
    // console.log(isoToCountry, layer.feature.id, isoToCountry[layer.feature.id]);

    // If data is not available for this country exit
    if (!(layer.feature.id in isoToCountry)) {
        alert("Data not found for " + layer.feature.properties.name);
        return;
    }
    
    if (originCountry === "NONE" && destinationCountry === "NONE") {
        originCountry = isoToCountry[layer.feature.id];
        originCountryLayer = layer;
        setOriginDropDown(originCountry);
    } else if (destinationCountry === "NONE") {
        destinationCountry = isoToCountry[layer.feature.id];
        destinationCountryLayer = layer;
        setOriginDropDown(originCountry);
        setDestinationDropDown(destinationCountry);
    } else {
        resetHighlightFixed(originCountryLayer);
        resetHighlightFixed(destinationCountryLayer);
        originCountry = "NONE";
        destinationCountry = "NONE";
        originCountryLayer = "NONE";
        destinationCountryLayer = "NONE";
        setOriginDropDown(originCountry);
        setDestinationDropDown(destinationCountry);
    }
    // console.log(originCountry, destinationCountry);

    if (originCountry !== "NONE" && originCountryLayer !== "NONE") {
        highlightFeatureFixed(originCountryLayer);
    } else {
        resetHighlightFixed(originCountryLayer);
    }

    if (destinationCountry !== "NONE" && destinationCountryLayer !== "NONE") {
        highlightFeatureFixed(destinationCountryLayer);
    } else {
        resetHighlightFixed(destinationCountryLayer);
    }
    applyFilter();
    drawVisualizations();
}

function selectRegion(e){
    const parentLayer = e.target;
    const parentISO = parentLayer.feature.id;
    const parentRegion = asylumToRegion.get(isoToCountry[parentISO]);
    
    if (originRegion === "NONE" && destinationRegion === "NONE") {
        originRegion = parentRegion;
        originRegionLayer = parentLayer;
    } else if (destinationRegion === "NONE") {
        destinationRegion = parentRegion;
        destinationRegionLayer = parentLayer;
    } else {
        resetHighlightFixedRegion(originRegionLayer);
        resetHighlightFixedRegion(destinationRegionLayer);
        originRegion = "NONE";
        destinationRegion = "NONE";
        originRegionLayer = "NONE";
        destinationRegionLayer = "NONE";
    }

    const countryList = regionToCountries.get(parentRegion);
    if(originRegion !== "NONE" && originRegionLayer !== "NONE"){
        highlightFeatureFixedRegion(originRegionLayer);
    }else{
        resetHighlightFixedRegion(originRegionLayer);
    }
    if(destinationRegion !== "NONE" && destinationRegionLayer !== "NONE"){
        highlightFeatureFixedRegion(destinationRegionLayer);
    }else{
        resetHighlightFixedRegion(destinationRegionLayer);
    }
    applyFilter();
    drawVisualizations();
}


// Define events for each feature (country)
function onEachFeature(feature, layer) {
    const countryISO = feature.id;
    if(countryISO in isoToCountry){
        countryToLayer.set(countryISO, layer);
    }
    if(showRegionPie){
        layer.on({
            mouseover: highlightFeatureRegion,
            mouseout: resetHighlightRegion,
            click: selectRegion
        });
    }else{
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: selectCountry
        });
    }
}


var originalMinYear;
var originalMaxYear;
function addPlayButton() {
    const parentContainer = d3.select("#controls-container-2");
    parentContainer.select("#play-button").remove(); // prevent duplicates

    let isPlaying = false;
    let shouldStop = false;
    let originalMinYear, originalMaxYear;

    parentContainer.append("button")
        .attr("id", "play-button")
        .style("margin-left", "20px")
        .style("height", "30px")
        .text("Play Year-by-Year")
        .on("click", async function () {
            const button = d3.select(this);

            if (!isPlaying) {
                // Start playback
                originalMinYear = startYear;
                originalMaxYear = endYear;
                isPlaying = true;
                shouldStop = false;
                button.text("Stop");

                for (let i = originalMinYear; i <= originalMaxYear; i++) {
                    if (shouldStop) break;

                    startYear = i;
                    endYear = i + 1;
                    applyFilter();
                    originDropDown();
                    destinationDropDown();
                    drawVisualizations();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                if (!shouldStop) {
                    // Auto reset after finish
                    startYear = originalMinYear;
                    endYear = originalMaxYear;
                    applyFilter();
                    originDropDown();
                    destinationDropDown();
                    drawVisualizations();
                    button.text("Play Year-by-Year");
                    isPlaying = false;
                }
            } else {
                // Stop and reset
                shouldStop = true;
                startYear = originalMinYear;
                endYear = originalMaxYear;
                applyFilter();
                originDropDown();
                destinationDropDown();
                drawVisualizations();
                button.text("Play Year-by-Year");
                isPlaying = false;
            }
        });
}


function originCheckBox() {
    var checkbox = d3.select("#region-analysis");
    checkbox.on("change", function () {
        let isChecked = d3.select(this).property("checked");
      
        if (isChecked) {
            showRegionPie = true;
            showRegionBar = true;
        } else {
            showRegionPie = false;
            showRegionBar = false
        }
        loadGeoJSON();
        applyFilter();
        drawVisualizations();
    });
}

// Pic chart implementation is inspired from (syntax)
// https://medium.com/@aleksej.gudkov/creating-a-pie-chart-with-d3-js-a-complete-guide-b69fd35268ea

function drawRegionPieChart() {
    d3.select("#region-pie").selectAll("svg").remove();
    d3.select("#pie").selectAll("svg").remove();

    if (!showRegionPie || originCountry === "NONE") {
        return;
    }
    var regionMigrantCount = new Map();

    var originCountryRegion = asylumToRegion.get(originCountry);
    var migrantCountInsideRegion = 0;
    var migrantCountOutsidesideRegion = 0;

    filtered_data[0].forEach(d => {
        var region = asylumToRegion.get(d.destination);
        if (regionMigrantCount.has(region)) {
            regionMigrantCount.set(region, regionMigrantCount.get(region) + d.migrantCount);
        } else {
            regionMigrantCount.set(region, d.migrantCount);
        }

        if (region === originCountryRegion) {
            migrantCountInsideRegion = migrantCountInsideRegion + d.migrantCount;
        } else {
            migrantCountOutsidesideRegion = migrantCountOutsidesideRegion + d.migrantCount;
        }
    });

    const data = [
        {region: "Within Region", migrantCount: migrantCountInsideRegion},
        {region: "Outside Region", migrantCount: migrantCountOutsidesideRegion},
    ]
    
    const data1 = [];

    for (const [key, value] of regionMigrantCount.entries()) {
        data1.push({region: key, migrantCount: value});
      }

    const width = 260;
    const height = 260;
    const radius = Math.min(width, height) / 2;

    function pieChart(data, divId) {
        const svg = d3.select(divId)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.region))
            .range(d3.schemeCategory10);

        const pie = d3.pie()
            .value(d => d.migrantCount)
            .padAngle(0.01);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .cornerRadius(4);
        const labelArc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius * 0.5);

        const slices = svg.selectAll('path')
            .data(pie(data))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.region))
            .attr('stroke', 'white')
            .style('stroke-width', '2px');

        svg.selectAll('text')
            .data(pie(data))
            .enter()
            .append('text')
            .attr('transform', d => {
                var [x, y] = labelArc.centroid(d);
                return `translate(${x}, ${y})`;
            })
            .text(function(d) {return `${d.data.region}: ${d.data.migrantCount}`;})
            .style('font-size', '12px')
            .style('fill', 'black');
    }
    pieChart(data, "#region-pie");
    // pieChart(data1, "#pie");

    var width2 = 350;
    var height2 = 300;
    function projectTo2D(lat, lon) {
        return [((lon + 180) / 360) * (width2 - 100), ((90 - lat) / 180) * height2];
    }
    var maxMC = d3.max(data1, d => d.migrantCount);
    var minMC = d3.min(data1, d => d.migrantCount);

    var rSectorScale = d3.scaleSqrt()
    .domain([minMC, maxMC])
    .range([10, 50]);

    const svg = d3.select("#pie")
    .append('svg')
    .attr('width', width2)
    .attr('height', height2);

    const color = d3.scaleOrdinal()
            .domain(data.map(d => d.region))
            .range(d3.schemeCategory10);

    var sectorG = svg.selectAll('.sector')
        .data(data1)
        .enter()
        .append('g')
        .attr('class', 'sector')
        .attr('transform', function(d) {
            var [lat, lon] = regionCoordinates2D[d.region];
            var [x, y] = projectTo2D(lat, lon);
            return 'translate(' + x + ',' + y + ')';
        })
        .style('fill', '#ccc');

    sectorG.append('circle')
        .attr('r', function(d) {
            return rSectorScale(d.migrantCount);
        })
        .style('fill', function(d) {return color(d.region);})
        .style("opacity", 0.5);

    sectorG.append('text')
        .text(function(d) {return `${d.region}:\n${d.migrantCount}`;})
        // .attr('y', function(d) {
        //     return rSectorScale(d.migrantCount) + 16;
        // })
        .attr('dy', '0.3em')
        .style('text-anchor', 'middle')
        .style('fill', 'black')
        .style('font-size', 14)
        .style('font-family', 'Open Sans');

}