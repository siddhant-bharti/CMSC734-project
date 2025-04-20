export async function loadDataSet(pathDataset) {
    return await d3.csv(pathDataset);
}

export function createCountryISOMapping(dataset) {
    var countryToIso = {};
    var isoToCountry = {};

    dataset.forEach(row => {
        if(row.OriginISO) {
            countryToIso[row.OriginName] = row.OriginISO;
            isoToCountry[row.OriginISO] = row.OriginName;
        }
        if(row.AsylumISO) {
            countryToIso[row.AsylumName] = row.AsylumISO;
            isoToCountry[row.AsylumISO] = row.AsylumName;
        }
    });
    return {countryToIso, isoToCountry};
}