import * as d3 from "d3";
import {
    Axis,
    BaseType,
    Selection,
    ScaleSequential,
    ZoomBehavior,
    ZoomedElementBaseType,
    D3ZoomEvent,
    ScaleTime,
    ScaleLinear,
    AxisDomain, json, text
} from "d3";

export class Waterfall {
    private data: WaterfallData;
    private dataURL: string;
    private tooltip: Selection<BaseType, unknown, HTMLElement, any>;
    private x: ScaleLinear<number, number, never>;
    private y: ScaleTime<number, number, never>;
    private animation: number;
    private annotations: any;
    private image: ImageBitmap;
    private interpolators: string[] = ["Viridis", "Inferno", "Magma", "Plasma", "Warm", "Cool", "Rainbow", "CubehelixDefault"];
    private xAxis: Axis<AxisDomain>;
    private yAxis: Axis<AxisDomain>;
    private div: Selection<HTMLElement, unknown, HTMLElement, any>;
    private canvas: Selection<HTMLCanvasElement, unknown, HTMLElement, any>;
    private svg: Selection<SVGSVGElement, unknown, HTMLElement, any>;
    private svgGroup: Selection<SVGGElement, unknown, HTMLElement, any>;
    private rectangle: Selection<SVGGElement, unknown, HTMLElement, any>;
    private xAxisGroup: Selection<SVGGElement, unknown, HTMLElement, any>;
    private yAxisGroup: Selection<SVGGElement, unknown, HTMLElement, any>;
    private xAxisLabel: Selection<BaseType, unknown, HTMLElement, any>;
    private yAxisLabel: Selection<BaseType, unknown, HTMLElement, any>;
    private tooltipGroup: Selection<BaseType, any, HTMLElement, any>;
    private signal: Selection<BaseType, unknown, HTMLElement, any>;
    private readonly margin: number;
    private readonly isZoomable: boolean;
    private readonly isAnimatable: boolean;
    private readonly annotationURL: string;
    private readonly z: ScaleSequential<string, never>;
    private readonly zoom: ZoomBehavior<ZoomedElementBaseType, unknown>;

    constructor(id: string, dataURL: string, annotationURL: string, isAnimatable: boolean, isSelectable: boolean, isZoomable: boolean) {


        // Assume a 50px margin around the waterfall display
        this.margin = 50;

        // Store the parsed CSV data and URL
        this.data = null;
        this.dataURL = dataURL;

        // Stored the parsed JSON data and URL
        this.annotations = null;
        this.annotationURL = annotationURL;
        this.tooltip = null;

        // Build the scaling functions from data to pixel coordinates
        this.x = null;
        this.y = null;
        this.z = d3.scaleSequential(d3.interpolateViridis);

        this.animation = null;
        // Store the request identifier for the animation callback
        this.isAnimatable = isAnimatable;

        this.isZoomable = isZoomable;
        // Build the elements used for zooming
        this.zoom = d3.zoom().on("zoom", this.onZoom);
        // Stores the ImageBitmap of the canvas
        this.image = null;

        // Parent container for the canvas, svg, and interpolator drop-down
        this.div = d3.select(id);

        // Build canvas first, behind the svg
        this.canvas = this.div.append("canvas");

        // Build the svg and its elements
        this.svg = this.div.append("svg");
        this.svgGroup = this.svg.append("g");
        this.rectangle = this.svgGroup.append("rect");
        this.xAxis = null;
        this.yAxis = null;
        this.xAxisGroup = this.svgGroup.append("g");
        this.yAxisGroup = this.svgGroup.append("g");
        this.xAxisLabel = this.svgGroup.append("text");
        this.yAxisLabel = this.svgGroup.append("text");
        this.tooltipGroup = this.svgGroup.append("g");
        
        (isSelectable === true) ? this.div.append("select")
            .on("change", this.onInterpolateChange).selectAll("option").data(this.interpolators)
            .enter()
            .append("option")
            .attr("value", (d): string => String(d))
            .text(function (d: string) {
                return d;
            }) : null;

    }

    // Callback for when the selected color interpolator is changed.
    onInterpolateChange(eventData: string, selectedIndex: number) {
        // Cancel any existing callbacks to drawStep
        if (this.animation && window.cancelAnimationFrame) window.cancelAnimationFrame(this.animation);

        // Change the interpolator and redraw
        this.z.interpolator(d3["interpolate" + this.interpolators[selectedIndex]]);
        let context = this.canvas.node().getContext("2d");
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        this.renderDisplay();
    }

// Callback to implement pan/zoom.
// Zooming is implemented using a stored ImageBitmap of the canvas to avoid redrawing the entire waterfall.
// TODO: Render canvas using higher resolution for better zooming.
    onZoom(event: D3ZoomEvent<any, any>) {
        // Prevent zooming if no image available or not zoomable
        if (!this.image || !this.isZoomable) return;

        // Build the new scaling functions, with clamping disabled, and rescale the axes
        this.xAxisGroup.call(this.xAxis.scale(event.transform.rescaleX(this.x)));
        this.yAxisGroup.call(this.yAxis.scale(event.transform.rescaleY(this.y)));

        // Rescale the annotations
        if (this.annotations) {
            this.tooltipGroup.attr("transform", "translate(" + event.transform.x + "," + event.transform.y + ") scale(" + event.transform.k + ")");
        }

        // Set the transformation matrix and redraw
        let context = this.canvas.node().getContext("2d");
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.save();
        context.translate(event.transform.x, event.transform.y);
        context.scale(event.transform.k, event.transform.k);
        context.drawImage(this.image, 0, 0, context.canvas.width, context.canvas.height);
        context.restore();
    }

// Event listener to keep tooltip visible when gaining mouse focus
    onTooltipMouseover(event: any, d: any) {

        this.signal.transition().duration(0);
        this.tooltip.transition().duration(0);
        this.signal.style("opacity", 0.5);
    }
    

// Event listener to show tooltip when signal gaining mouse focus
// Highlight the signal and set the tooltip.
    onSignalMouseover(event: any, d: any): void {
        this.signal = d3.select(d);

        this.signal.transition(d3.transition().duration(100))
            .style("opacity", 0.5);
        this.tooltip.style("left", event.offsetX + 5 + "px")
            .style("top", event.offsetY + 5 + "px");
        this.tooltip.transition(d3.transition().duration(100))
            .style("visibility", "visible");
        this.tooltip.html("<a href=\"" + d.url + "\" target=\"_blank\"><strong>" + event.description + "</strong></a><br><strong>Frequency:</strong> " + this.formatFrequency(d.freqStart) + " - " + this.formatFrequency(d.freqStop));
    }

// Event listener to hide tooltip when signal losing mouse focus
    onSignalMouseout(event: any, d:any): void {
        this.signal.transition(d3.transition().delay(100).duration(100))
            .style("opacity", 0);
        this.tooltip.transition(d3.transition().delay(100).duration(100))
            .style("visibility", "hidden");
    }

    // Downloads and parses the data and annotation files//
// cb: Function to call when completed. Generally should be set to initDisplay.
    getDataFromDataURL(dataURL: string, cb: (param: Waterfall) => void) {

        let dataRequest = text(dataURL)
            .then(response => this.parseCSVData(response));
        let annotationRequest = this.annotationURL
            ? json<string>(this.annotationURL).then(response => this.parseJSONData(response))
            : Promise.resolve(null);

        Promise.all([dataRequest, annotationRequest])
            .then(() => {
                if (cb) cb(this);
            })
            .catch((error) => {
                throw error;
            });
    }

// Downloads and parses the data and annotation files//
// cb: Function to call when completed. Generally should be set to initDisplay.
    getData(rtlPowerCSV: string, cb: (param: Waterfall) => void) {

        let dataRequest = text(rtlPowerCSV)
            .then(response => this.parseCSVData(response));
        let annotationRequest = this.annotationURL
            ? json<string>(this.annotationURL).then(response => this.parseJSONData(response))
            : Promise.resolve(null);

        Promise.all([dataRequest, annotationRequest])
            .then(() => {
                if (cb) cb(this);
            })
            .catch((error) => {
                throw error;
            });
    }

// Parses the raw CSV data from rtl_power
    parseCSVData(response: string): void{
        let parser = d3.timeParse("%Y-%m-%d %H:%M:%S");

        let freqStep = 0,
            freqRange = [Number.MAX_VALUE, Number.MIN_VALUE],
            timeRange = [Number.MAX_VALUE, Number.MIN_VALUE],
            dbRange = [Number.MAX_VALUE, Number.MIN_VALUE];

        function parseRow(rawRowString: string[], index: number) {
            let dateTime = parser(rawRowString[0] + rawRowString[1]), // date + time
                freqLow = +rawRowString[2], // Hz low
                freqHigh = +rawRowString[3]; // Hz high
            freqStep = +rawRowString[4]; // Hz step

            let results: RFResult[] = [];
            for (i = 6; i < rawRowString.length; i++) {
                let dB = +rawRowString[i];
                // Clamp NaN results or unrecognized string parses
                if (isNaN(dB))
                    dB = dbRange[0];

                dbRange = [Math.min(dbRange[0], dB), Math.max(dbRange[1], dB)];

                let result = new RFResult();
                result.dateTime = dateTime;
                result.freq = freqLow + (i - 6) * freqStep;
                result.dB = dB;

                results.push(result);
            }

            // Compute the fixed frequency step, and frequency/time/dB range
            freqRange = [Math.min(freqRange[0], freqLow), Math.max(freqRange[1], freqHigh)];
            timeRange = [Math.min(timeRange[0], dateTime.getTime()), Math.max(timeRange[1], dateTime.getTime())];

            return results;
        }

        let rfResults = d3.csvParseRows(response, parseRow);
        // Convert the raw values from an 1 * (N x M) to N * M array,
        // where N is the number of sweeps across the frequency range,
        // and M is the number of readings in each sweep.
        let values :any[] = [];
        let i = -1;
        rfResults.forEach(function (result) {
            for (let j = 0; j < result.length; j++) {
                if (result[j].freq != rfResults[0][0].freq) {
                    values[i].values.push({
                        freq: result[j].freq,
                        dB: result[j].dB,
                    });
                } else {
                    values[++i] = {
                        dateTime: result[j].dateTime,
                        values: [],
                    };
                }
            }
        });

        // Adjust the time range by the estimated width/duration of the last step
        timeRange[1] += +values[values.length - 1].dateTime - +values[values.length - 2].dateTime;

        // Create the data object with metadata and values array
        this.data = new WaterfallData(freqRange, freqStep, dbRange, values, timeRange);
    }

// Parses the JSON known signals from sigid_csv_to_json.py
    parseJSONData(response: string): void {
        this.annotations = JSON.parse(response);
    }

// Formatter for frequency that uses SI and appends units
    formatFrequency(n: number): string {
        return d3.format(".3s")(n) + "Hz";
    }

// Initializes the waterfall display and its elements
    initDisplay() {
        // Compute the element sizes
        let width = this.div.node().clientWidth - 5,
            height = window.innerHeight - 15,
            elementWidth = width - 2 * this.margin,
            elementHeight = height - 2 * this.margin;

        // Set the svg size and add margin for labels
        this.svg.attr("width", width)
            .attr("height", height)
            .style("position", "absolute");
        this.svgGroup.attr("transform", "translate(" + this.margin + "," + this.margin + ")");

        // Create the scaling functions from the actual values to the size of the drawing surface on the canvas.
        // Apply rounded interpolation to eliminate graphical artifacts from numerical imprecision.
        this.x = d3.scaleLinear().range([0, elementWidth]).interpolate(d3.interpolateRound);
        this.y = d3.scaleTime().range([0, elementHeight]).interpolate(d3.interpolateRound);

        // Set the domain for each axis using the data range (min, max)
        this.x.domain(this.data.freqRange);
        this.y.domain(this.data.timeRange);
        this.z.domain(this.data.dbRange);

        // Set the canvas size to the element size, and draw an invisible svg rectangle on top
        this.canvas.attr("width", elementWidth)
            .attr("height", elementHeight)
            .style("padding", this.margin + "px")
            .style("position", "absolute");
        this.rectangle.attr("width", elementWidth)
            .attr("height", elementHeight)
            .style("fill", "#fff")
            .style("opacity", 0)
            .call(this.zoom);

        // Set the ticks on the axes, with a custom formatter for units
        this.xAxis = d3.axisTop(this.x).ticks(16).tickFormat(this.formatFrequency);
        this.xAxisGroup.attr("class", "axis x-axis")
            .call(this.xAxis);
        this.yAxis = d3.axisLeft(this.y);
        this.yAxisGroup.attr("class", "axis y-axis")
            .call(this.yAxis);

        // Set the text labels on the axes
        this.xAxisLabel.attr("class", "axis x-axis")
            .attr("text-anchor", "middle")
            .attr("transform", "translate(" + elementWidth / 2 + "," + -this.margin / 2 + ")")
            .text("Frequency");
        this.yAxisLabel.attr("class", "axis y-axis")
            .attr("text-anchor", "middle")
            .attr("transform", "translate(" + -this.margin / 2 + "," + (this.margin / 4) + ")")
            .text("Time");

        // Create the tooltips, with clamping enabled
        if (this.annotations) {
            this.x.clamp(true);

            this.tooltip = this.div.append("div")
                .attr("class", "tooltip")
                .style("opacity", 0.75)
                .style("position", "absolute")
                .style("visibility", "hidden")
                .on("mouseover", this.onTooltipMouseover)
                .on("mouseout", this.onSignalMouseout);

            // Display the annotations by highlighting the signal and showing the tooltip
            this.tooltipGroup.selectAll("rect")
                .data(this.annotations)
                .enter().append("rect")
                .attr("class", "signal")
                .attr("x", (d:any) => this.x(d.freqStart))
                .attr("y", this.y(+this.y.domain()[0]))
                .attr("width", (d:any) => this.x(d.freqStop) - this.x(d.freqStart))
                .attr("height", this.y(+this.y.domain()[1]) - this.y(+this.y.domain()[0]))
                .style("fill", "#fff")
                .style("opacity", 0)
                .on("mouseover", this.onSignalMouseover)
                .on("mouseout", this.onSignalMouseout)
                .call(this.zoom);

            this.x.clamp(false);
        }

        // Draw the waterfall
        this.renderDisplay();
    }

// If animation callbacks are available, draw a row of rectangles in each callback.
// Otherwise, draw everything at once, but the canvas will not be updated until done.
    renderDisplay() {
        let context = this.canvas.node().getContext("2d");

        // Invalidate the image data cache
        if (this.isZoomable) this.image = null;

        if (this.isAnimatable && window.requestAnimationFrame) {
            let i = 0;
            let drawStep = (timestamp: number) => {
                this.drawRow.call({context: context, x: this.x, y: this.y, z: this.z}, i, this.data.values);

                // Cache the image data if done
                if (++i < this.data.values.length) {
                    this.animation = window.requestAnimationFrame(drawStep);
                } else if (this.isZoomable && createImageBitmap) {
                    createImageBitmap(context.getImageData(0, 0, context.canvas.width, context.canvas.height))
                        .then((value: ImageBitmap) => this.image = value)
                        .catch((error: any) => {
                            throw error;
                        });
                }
            };

            this.animation = window.requestAnimationFrame(drawStep);
        } else {
            this.data.values.forEach(this.drawRow, {context: context, x: this.x, y: this.y, z: this.z});
        }
    }

// Draw one row/timestep of data.
// Computes the rectangle height using the next time step, or if not available, the previous time step.
// TODO: Memoize this function for better performance.
    drawRow(value: any, index: number, dataColumns: any[]) {
        for (let j = 0; j < dataColumns[index].values.length; ++j) {
            let rowWidth = (index != dataColumns.length - 1 && j < dataColumns[index + 1].values.length) ? this.y(+dataColumns[index + 1].dateTime) - this.y(+dataColumns[index].dateTime) : this.y(+dataColumns[index].dateTime) - this.y(+dataColumns[index - 1].dateTime);
            let context = this.canvas.node().getContext("2d");
            context.fillStyle = this.z(dataColumns[index].values[j].dB);
            context.fillRect(this.x(dataColumns[index].values[j].freq), this.y(dataColumns[index].dateTime), this.x(dataColumns[index].values[j].freq + this.data.freqStep) - this.x(dataColumns[index].values[j].freq), rowWidth);
        }
    }
}

    