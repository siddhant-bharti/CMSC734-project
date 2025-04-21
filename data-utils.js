export async function loadDataSet(pathDataset) {
    return await d3.csv(pathDataset);
}

export function createCountryISOMapping(dataset) {
    var countryToIso = {};
    var isoToCountry = {};

    dataset.forEach(row => {
        if(row.OriginISO) {
            countryToIso[row.origin] = row.OriginISO;
            isoToCountry[row.OriginISO] = row.origin;
        }
        if(row.AsylumISO) {
            countryToIso[row.destination] = row.AsylumISO;
            isoToCountry[row.AsylumISO] = row.destination;
        }
    });
    return {countryToIso, isoToCountry};
}