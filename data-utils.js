export async function loadDataSet(pathDataset) {
    return await d3.csv(pathDataset);
}