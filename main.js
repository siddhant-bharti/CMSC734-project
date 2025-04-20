import {loadDataSet, createCountryISOMapping} from "./data-utils.js";


var map = d3.select('#map');
var mapWidth = +map.attr('width');
var mapHeight = +map.attr('height');

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
var width = +svg.attr("width"), height = +svg.attr("height");
var flowMapG = svg.select('g').attr('class', 'leaflet-zoom-hide');

// Projection from lat, long to x, y
const projection = d3.geoMercator()
    .scale(150)
    .translate([width / 2, height / 1.5]);

Promise.all([
    // loadDataSet("./datasets/dataset_denormalized_enriched_pruned.csv")
    loadDataSet("./datasets/filtered_origin_RWA.csv")
]).then(function(data) {
    var migrationData = data[0];
    // const {countryToIso, isoToCountry} = createCountryISOMapping(migrationData);
    // console.log(countryToIso);
    // console.log(isoToCountry);
    visualizeMigration(migrationData);
});

function visualizeMigration(data) {
    // console.log(data);
    data.forEach(d => d.migrants = +d.migrants);
    const maxMigrantCount = d3.max(data, d => d.migrants);
    const thicknessScale = d3.scaleLinear()
        .domain([0, maxMigrantCount])
        .range([1, 10]);

    
}



// d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then(worldData => {
//     svg.append("g")
//         .selectAll("path")
//         .data(worldData.features)
//         .enter().append("path")
//         .attr("d", d3.geoPath().projection(projection))
//         .attr("fill", "#ddd")
//         .attr("stroke", "#999");
//     d3.csv("./datasets/filtered_origin_RWA.csv").then(data => {
//         data.forEach(d => d.migrants = +d.migrants);
//         const maxMigrantCount = d3.max(data, d => d.migrants);
//         const thicknessScale = d3.scaleLinear()
//             .domain([0, maxMigrantCount])
//             .range([1, 10]);
//         svg.append("defs").append("marker")
//             .attr("id", "arrowhead")
//             .attr("viewBox", "0 0 10 10")
//             .attr("refX", 6)  
//             .attr("refY", 5)
//             .attr("markerWidth", 2)  
//             .attr("markerHeight", 2)
//             .attr("orient", "auto")
//             .append("path")
//             .attr("d", "M 0 0 L 10 5 L 0 10 Z") 
//             .attr("fill", "blue");
//         data.forEach(d => {
//             let origin = projection([+d.origin_lon, +d.origin_lat]);
//             let destination = projection([+d.dest_lon, +d.dest_lat]);
//             if (!origin || !destination) return;
//             let strokeWidth = thicknessScale(d.migrants);
//             let randomOffset = Math.random() * 100 - 50;
//             let controlPoint = [
//                 (origin[0] + destination[0]) / 2,
//                 Math.min(origin[1], destination[1]) + randomOffset
//             ];
//             let line = d3.line()
//                 .x(d => d[0])
//                 .y(d => d[1])
//                 .curve(d3.curveBasis)
//             let points = [origin, controlPoint, destination];
//             svg.append("path")
//                 .attr("d", line(points))
//                 .attr("fill", "none")
//                 .attr("stroke", "blue")
//                 .attr("stroke-width", strokeWidth)
//                 .attr("opacity", 0.5)
//                 .attr("marker-end", "url(#arrowhead)"); 
//         });
//     }).catch(error => console.error("Error loading CSV:", error));
// });
