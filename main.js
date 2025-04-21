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

Promise.all([
    d3.csv('./datasets/test.csv', function(row) {
        var link = {origin: [+row['origin_lat'], +row['origin_lon']], destination: [+row['dest_lat'], +row['dest_lon']], 
            migrantCount: +row['migrants'] };
        return link; 
    })     
]).then(function(data) {
    var links = data[0];
    drawFlowMap(links);
});

function drawFlowMap(links) {
    const maxMigrantCount = d3.max(links, d => d.migrantCount);
    const thicknessScale = d3.scaleLinear().domain([0, maxMigrantCount]).range([1, 10]);

    nodeLinkG.selectAll('.grid-link')
    .data(links)
    .enter().append('line')
    .attr('class', 'grid-link')
    .style('stroke', '#999')
    .style('stroke-opacity', 0.5)
    .style('stroke-width', function(d){ return thicknessScale(d.migrantCount) })      
    myMap.on('zoomend', updateLayers);
    updateLayers();
}

function updateLayers(){
    nodeLinkG.selectAll('.grid-link')
    .attr('x1', function(d){return myMap.latLngToLayerPoint(d.origin).x})
    .attr('y1', function(d){return myMap.latLngToLayerPoint(d.origin).y})
    .attr('x2', function(d){return myMap.latLngToLayerPoint(d.destination).x})
    .attr('y2', function(d){return myMap.latLngToLayerPoint(d.destination).y});
}




