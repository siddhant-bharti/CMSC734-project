import pandas as pd
import numpy as np
import pycountry
from geopy.geocoders import Nominatim
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm import tqdm


GEOLOCATION = Nominatim(user_agent="geoapi")
COUNTRY_ISO_TO_CAPITAL_COORDINATES = {}


def get_dataset(dataset_path: str) -> pd.DataFrame:
    return pd.read_csv(dataset_path)


@retry(
    wait=wait_exponential(multiplier=1, max=10),
    stop=stop_after_attempt(4),
    reraise=True,
)
def get_capital_coordinates_util(country_iso: str):
    """Function to return country capital and its coordinates"""
    global COUNTRY_ISO_TO_CAPITAL_COORDINATES, GEOLOCATION
    if country_iso in COUNTRY_ISO_TO_CAPITAL_COORDINATES.keys():
        return COUNTRY_ISO_TO_CAPITAL_COORDINATES[country_iso]

    country = pycountry.countries.get(alpha_3=country_iso)
    location = GEOLOCATION.geocode(f"{country.name}", timeout=10)
    COUNTRY_ISO_TO_CAPITAL_COORDINATES[country_iso] = {
        "country": country,
        "location": location,
    }
    return COUNTRY_ISO_TO_CAPITAL_COORDINATES[country_iso]


def get_capital_coordinates(country_iso: str):
    global COUNTRY_ISO_TO_CAPITAL_COORDINATES, GEOLOCATION
    try:
        return get_capital_coordinates_util(country_iso)
    except Exception as e:
        # Added this to ensure we do not retry a country that saw failure in past
        # this is done due to rate limiting.
        print(f"Complete failure for {country_iso}")
        COUNTRY_ISO_TO_CAPITAL_COORDINATES[country_iso] = {}


def process_dataset():
    dataset = get_dataset(dataset_path="dataset/dataset_denormalized.csv")
    dataset["originName"] = np.nan
    dataset["originOfficialName"] = np.nan
    dataset["originLatitude"] = np.nan
    dataset["originLongitude"] = np.nan

    dataset["asylumName"] = np.nan
    dataset["asylumOfficialName"] = np.nan
    dataset["asylumLatitude"] = np.nan
    dataset["asylumLongitude"] = np.nan

    for idx, row in tqdm(dataset.iterrows(), total=len(dataset)):
        try:
            origin_coordinates = get_capital_coordinates(row["OriginISO"])
            asylum_coordinates = get_capital_coordinates(row["AsylumISO"])

            dataset.at[idx, "originName"] = origin_coordinates["country"].name
            dataset.at[idx, "originOfficialName"] = origin_coordinates[
                "country"
            ].official_name
            dataset.at[idx, "originLatitude"] = origin_coordinates["location"].latitude
            dataset.at[idx, "originLongitude"] = origin_coordinates[
                "location"
            ].longitude

            dataset.at[idx, "asylumName"] = asylum_coordinates["country"].name
            dataset.at[idx, "asylumOfficialName"] = asylum_coordinates[
                "country"
            ].official_name
            dataset.at[idx, "asylumLatitude"] = asylum_coordinates["location"].latitude
            dataset.at[idx, "asylumLongitude"] = asylum_coordinates[
                "location"
            ].longitude
            if idx % 1000 == 0:
                # Checkpoint data!
                dataset.to_csv("dataset/dataset_denormalized_enriched.csv", index=False)
        except Exception as e:
            print(e)

    dataset.to_csv("dataset/dataset_denormalized_enriched.csv", index=False)


def prune_dataset():
    dataset = get_dataset(dataset_path="dataset/dataset_denormalized_enriched.csv")
    dataset = dataset[
        dataset["originLatitude"].notna() & dataset["asylumLatitude"].notna()
    ]
    dataset.to_csv("dataset/dataset_denormalized_enriched_pruned.csv", index=False)


if __name__ == "__main__":
    # process_dataset()
    prune_dataset()
