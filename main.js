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

Promise.all([
    d3.csv('./datasets/dataset_denormalized_enriched_pruned.csv', function(row) {
        var link = {origin: row['originName'], originCoord: [+row['originLatitude'], +row['originLongitude']], destination: row['asylumName'], destinationCoord: [+row['asylumLatitude'], +row['asylumLongitude']], 
            migrantCount: +row[' Count'].replace(/,/g, '').trim(), year: +row['Year']};
        return link; 
    }),
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/data_sankey.json", function(error, graph){
        return graph;
    })     
]).then(function(data) {
    var links = data[0];
    drawSlider(links);
    drawFlowMap(links);
    drawBarChart(links);
    drawSankeyDiagram(data[1]);
});

function drawSlider(links) {

    const maxYear = d3.max(links, d => d.year);
    const minYear = d3.min(links, d => d.year);

    // Define the slider
    var sliderRange = d3
    .sliderBottom()
    .min(new Date(minYear, 0, 1))
    .max(new Date(maxYear, 0, 1))
    .width(300)
    .tickFormat(d3.timeFormat('%Y'))
    .ticks(3)
    .default([new Date(minYear, 0, 1), new Date(maxYear, 0, 1)])
    .fill('#85bb65');

    sliderRange.on('onchange', val => {
        console.log(val);
    
    });
    
    // Add the slider to the DOM
    const gRange = d3
        .select('#slider-range')
        .append('svg')
        .attr('width', 500)
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(90,30)');
    
    gRange.call(sliderRange);
    
}

function drawFlowMap(links) {
    const filteredLinks = links.filter(d => d.origin === "China");

    const maxMigrantCount = d3.max(filteredLinks, d => d.migrantCount);
    const minMigrantCount = d3.min(filteredLinks, d => d.migrantCount);
    const thicknessScale = d3.scaleLinear().domain([minMigrantCount, maxMigrantCount]).range([1, 10]);

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


var margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 600 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

var svg = d3.select("#sankey").append("svg")
.attr("width", width + margin.left + margin.right)
.attr("height", height + margin.top + margin.bottom)
.append("g")
.attr("transform","translate(" + margin.left + "," + margin.top + ")");

// var color = d3.scaleOrdinal(d3.schemeCategory20);

var sankey = d3.sankey()
.nodeWidth(36)
.nodePadding(290)
.size([width, height]);

function drawSankeyDiagram(graph) {
    sankey
      .nodes(graph.nodes)
      .links(graph.links)
      .layout(1);

    // add in the links
    var link = svg.append("g")
        .selectAll(".link")
        .data(graph.links)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", sankey.link() )
        .style("stroke-width", function(d) { return Math.max(1, d.dy); })
        .sort(function(a, b) { return b.dy - a.dy; });

    // add in the nodes
    var node = svg.append("g")
        .selectAll(".node")
        .data(graph.nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
        .call(d3.drag()
            .subject(function(d) { return d; })
            .on("start", function() { this.parentNode.appendChild(this); })
        .on("drag", dragmove));

    // add the rectangles for the nodes
    node
    .append("rect")
        .attr("height", function(d) { return d.dy; })
        .attr("width", sankey.nodeWidth())
        // Add hover text
        .append("title")
        .text(function(d) { return d.name + "\n" + "There is " + d.value + " stuff in this node"; });

    // add in the title for the nodes
    node
    .append("text")
        .attr("x", -6)
        .attr("y", function(d) { return d.dy / 2; })
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .attr("transform", null)
        .text(function(d) { return d.name; })
    .filter(function(d) { return d.x < width / 2; })
        .attr("x", 6 + sankey.nodeWidth())
        .attr("text-anchor", "start");

    // the function for moving the nodes
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

function drawBarChart(links) {
    const width = 600;
    const height = 600;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };

    d3.select("#bar").select("svg").remove();

    const svg = d3.select("#bar")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Cluster the number of migrants by origin, and sum then up
    const totalsByOrigin = {};
    links.forEach(d => {
        if (!totalsByOrigin[d.origin]) {
            totalsByOrigin[d.origin] = 0;
        }
        totalsByOrigin[d.origin] += d.migrantCount;
    });

    // Log results
    // for (const origin in totalsByOrigin) {
    //     console.log(`${origin}: ${totalsByOrigin[origin]}`);
    // }

    const data = Object.entries(totalsByOrigin).map(([origin, migrantCount]) => ({ origin, migrantCount }));
    // data.sort((a, b) => d3.descending(a.migrantCount, b.migrantCount)).slice(0, 10);

    const top10 = data.sort((a, b) => b.migrantCount - a.migrantCount).slice(0, 10);
    const x = d3.scaleBand()
        .domain(top10.map(d => d.origin))
        .range([margin.left, width - margin.right])
        .padding(0.1);
    const y = d3.scaleLinear()
        .domain([0, d3.max(top10, d => d.migrantCount)])
        .nice()
        .range([height - margin.bottom, margin.top]);
    
    svg.append("g")
        .attr("fill", "steelblue")
        .selectAll("rect")
        .data(top10)
        .enter()
        .append("rect")
        .attr("x", d => x(d.origin))
        .attr("y", d => y(d.migrantCount))
        .attr("height", d => y(0) - y(d.migrantCount))
        .attr("width", x.bandwidth());
    
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat((d, i) => top10[i].origin).ticks(5))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");
    
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(10));
}

