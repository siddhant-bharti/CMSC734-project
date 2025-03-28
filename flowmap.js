const svg = d3.select("#map svg"),
      width = +svg.attr("width"),
      height = +svg.attr("height");

// Projection from lat, long to x, y
const projection = d3.geoMercator()
    .scale(150)
    .translate([width / 2, height / 1.5]);

d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then(worldData => {
    svg.append("g")
        .selectAll("path")
        .data(worldData.features)
        .enter().append("path")
        .attr("d", d3.geoPath().projection(projection))
        .attr("fill", "#ddd")
        .attr("stroke", "#999");
    d3.csv("filtered_USA.csv").then(data => {
        data.forEach(d => d.migrants = +d.migrants);
        const maxMigrantCount = d3.max(data, d => d.migrants);
        const thicknessScale = d3.scaleLinear()
            .domain([0, maxMigrantCount])
            .range([1, 10]);
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
            .attr("fill", "blue");
        data.forEach(d => {
            let origin = projection([+d.origin_lon, +d.origin_lat]);
            let destination = projection([+d.dest_lon, +d.dest_lat]);
            if (!origin || !destination) return;
            let strokeWidth = thicknessScale(d.migrants);
            let randomOffset = Math.random() * 100 - 50;
            let controlPoint = [
                (origin[0] + destination[0]) / 2,
                Math.min(origin[1], destination[1]) + randomOffset
            ];
            let line = d3.line()
                .x(d => d[0])
                .y(d => d[1])
                .curve(d3.curveBasis)
            let points = [origin, controlPoint, destination];
            svg.append("path")
                .attr("d", line(points))
                .attr("fill", "none")
                .attr("stroke", "blue")
                .attr("stroke-width", strokeWidth)
                .attr("opacity", 0.5)
                .attr("marker-end", "url(#arrowhead)"); 
        });
    }).catch(error => console.error("Error loading CSV:", error));
});
