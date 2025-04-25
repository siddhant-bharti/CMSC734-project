import {loadDataSet, createCountryISOMapping} from "./data-utils.js";

var map = d3.select('#map');
var mapWidth = +map.attr('width');
var mapHeight = +map.attr('height');
var vertices = d3.map();
var activeMapType = 'nodes_links';
var nodeFeatures = [];

var myMap = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
    maxZoom: 10,
    minZoom: 3,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
}).addTo(myMap);
// L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.{ext}', {
// 	minZoom: 2,
// 	maxZoom: 10,
// 	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
// 	ext: 'png'
// }).addTo(myMap);

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
var destinationCountry = "NONE";  // store origin

// some mapping
var countryToIso;
var isoToCountry;
var asylumToRegion = new Map();

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
    });

    applyFilter();
    drawSlider();
    addPlayButton();
    originDropDown();
    destinationDropDown();
    drawVisualizations();
});

function doDrawSankey() {
    if (originCountry === "NONE" && destinationCountry === "NONE") {
        return false;
    } else if (originCountry !== "NONE" && destinationCountry !== "NONE") {
        return false;
    }
    return true;
}

function doDrawRegions() {
    return true;
}

function drawVisualizations() {
    drawFlowMap();
    drawBarChart();
    drawSankeyDiagram();
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
        applyFilter();
        drawVisualizations();
    }
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
        applyFilter();
        drawVisualizations();
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
            if (doDrawRegions){
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
    if (doDrawRegions) {
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

    if (doDrawSankey || doDrawRegions){
        var color = d3.scaleOrdinal(d3.schemeCategory10);

        var margin = {top: 10, right: 10, bottom: 10, left: 10},
        width = 600 - margin.left - margin.right,
        height = 1200 - margin.top - margin.bottom;

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
            if(doDrawRegions){
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
    const width = 600;
    const height = 600;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };
    const barHeight = 25;
    const totalsByDestination = {};

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
        .attr("width", d => x(d.migrantCount) - x(0));
    
    // UPDATE
    bars.transition()
        .duration(500)
        .attr("y", (d, i) => margin.top + i * barHeight)
        .attr("width", d => x(d.migrantCount) - x(0));
    
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
        .style("font-size", "10px")
        .style("opacity", 0)
        .text(d => d.AsylumISO)
        .transition()
        .duration(500)
        .style("opacity", 1);

    // UPDATE
    labels.transition()
        .duration(500)
        .attr("y", (d, i) => margin.top + i * barHeight + (barHeight / 2))
        .text(d => d.AsylumISO);

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
            .attr("transform", `translate(0, ${margin.top - 5})`)
            .call(d3.axisTop(xlabel).ticks(5))
            .selectAll("text")
            .style("font-size", "10px");
    } else {
        // Update: transition the axis
        xAxisGroup.transition()
            .duration(500)
            .call(d3.axisTop(xlabel).ticks(5));

        // Optional: update label style
        xAxisGroup.selectAll("text")
            .style("font-size", "10px");
    }
}

var originalMinYear;
var originalMaxYear;
function addPlayButton() {
    const parentContainer = d3.select("#slider-range-container");
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