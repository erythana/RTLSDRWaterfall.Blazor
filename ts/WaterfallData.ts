class WaterfallData {
    freqRange: number[];
    freqStep: number;
    dbRange: number[];
    values: any[];
    timeRange: number[];

    constructor(
        freqRange: number[],
        freqStep: number,
        dbRange: number[],
        values: any[],
        timeRange: number[]
    ) {
        this.freqRange = freqRange;
        this.freqStep = freqStep;
        this.dbRange = dbRange;
        this.values = values;
        this.timeRange = timeRange;
    }
}