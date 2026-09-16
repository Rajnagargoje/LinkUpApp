import {
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSpinner,
  IonToast,
  useIonRouter,
} from "@ionic/react";

import {
  checkmarkCircle,
  chatbubbleEllipsesOutline,
  locationOutline,
  refreshOutline,
  personCircleOutline,
} from "ionicons/icons";

import { useCallback, useEffect, useState } from "react";

import Header from "../../header/Header";
import "./PeoplePage.scss";

import { getNearbyPeople, updateLocation } from "../../service/userService";
import { useAuth } from "../../contexts/AuthContext";
import { Persons } from "../../common/person.model";

type FilterType = "nearby" | "online" | "new" | "popular";

const FILTERS = [
  {
    id: "nearby" as FilterType,
    label: "Nearby",
  },
  {
    id: "online" as FilterType,
    label: "Online",
  },
  {
    id: "new" as FilterType,
    label: "New here",
  },
  {
    id: "popular" as FilterType,
    label: "Popular",
  },
];

const PeoplePage: React.FC = () => {
  const { user } = useAuth();
  const [people, setPeople] = useState<Persons[]>([]);
  const router = useIonRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>("nearby");

  const [loading, setLoading] = useState(true);

  const [locationLoading, setLocationLoading] = useState(false);

  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState("");

  /*
   * ----------------------------------------------------
   * GET CURRENT LOCATION
   * ----------------------------------------------------
   */

  const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this device."));

        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
    });
  };

  /*
   * ----------------------------------------------------
   * UPDATE USER LOCATION
   * ----------------------------------------------------
   */

  // const updateUserLocation = async (latitude: number, longitude: number) => {
  //   try {
  //     const response = await fetch(`${API_BASE_URL}/users/location`, {
  //       method: "POST",

  //       headers: {
  //         "Content-Type": "application/json",
  //       },

  //       body: JSON.stringify({
  //         latitude,
  //         longitude,
  //       }),
  //     });

  //     if (!response.ok) {
  //       throw new Error("Unable to update your location.");
  //     }
  //   } catch (error) {
  //     console.error("Location update error:", error);

  //     throw error;
  //   }
  // };

  /*
   * ----------------------------------------------------
   * GET NEARBY PEOPLE
   * ----------------------------------------------------
   */

  const fetchNearbyPeople = async () => {
    try {
      setLoading(true);

      /*
       * Get GPS location
       */

      setLocationLoading(true);

      const position = await getCurrentLocation();

      const latitude = position.coords.latitude;

      const longitude = position.coords.longitude;

      setLocationPermission(true);

      console.log("Latitude:", latitude);
      console.log("Longitude:", longitude);

      /*
       * Send location to backend
       */

      await updateLocation(user!.username, latitude, longitude);

      setLocationLoading(false);

      /*
       * Get nearby users
       */

      try {
        const data = await getNearbyPeople(user!.username);

        setPeople(data.data);
      } catch (error) {
        console.error(error);
      }
    } catch (error) {
      console.error("Nearby people error:", error);

      setLocationLoading(false);

      setToastMessage("Unable to access your location or load nearby people.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * ----------------------------------------------------
   * INITIAL LOAD
   * ----------------------------------------------------
   */

  useEffect(() => {
    fetchNearbyPeople();
  }, []);

  /*
   * ----------------------------------------------------
   * FILTER PEOPLE
   * ----------------------------------------------------
   */

  const getFilteredPeople = () => {
    switch (activeFilter) {
      case "online":
        return people.filter((Persons) => Persons.online);

      case "new":
        return people.filter((Persons) => Persons.meta === "New here");

      case "popular":
        /*
         * For now return all.
         *
         * Later backend can provide
         * popularity score.
         */

        return people;

      case "nearby":
      default:
        return [...people].sort((a, b) => a.distanceKm - b.distanceKm);
    }
  };

  const filteredPeople = getFilteredPeople();

  /*
   * ----------------------------------------------------
   * REFRESH
   * ----------------------------------------------------
   */

  const handleRefresh = async (event: CustomEvent) => {
    await fetchNearbyPeople();

    event.detail.complete();
  };

  /*
   * ----------------------------------------------------
   * CHAT
   * ----------------------------------------------------
   */

  const handleChat = (Persons: Persons) => {
    console.log("Start chat with:", Persons);

    /*
     * Later:
     *
     * history.push("/app/chatPage", {
     *   receiverId: Persons.id,
     *   username: Persons.name
     * });
     */
  };

  /*
   * ----------------------------------------------------
   * PROFILE
   * ----------------------------------------------------
   */

  const handleProfileClick = (Persons: Persons) => {
    console.log("Open profile:", Persons.publicId);

    router.push(`/app/person/${Persons.publicId}`);
  };

  /*
   * ----------------------------------------------------
   * LOCATION BUTTON
   * ----------------------------------------------------
   */

  const handleEnableLocation = async () => {
    await fetchNearbyPeople();
  };

  return (
    <IonPage>
      <Header />

      <IonContent fullscreen className="people-content">
        {/* -----------------------------------------
            LOCATION STATUS
        ------------------------------------------ */}

        {!locationPermission && !loading && (
          <div className="location-message">
            <IonIcon icon={locationOutline} />

            <div>
              <strong>Enable location</strong>

              <span>Allow location to discover people near you.</span>
            </div>

            <button onClick={handleEnableLocation}>
              <IonIcon icon={refreshOutline} />
            </button>
          </div>
        )}

        {/* -----------------------------------------
            FILTER CHIPS
        ------------------------------------------ */}

        <div className="people-filter-row">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              className={`filter-chip ${
                activeFilter === filter.id ? "filter-chip--active" : ""
              }`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}

              {filter.id === "online" && (
                <span className="filter-chip-count">
                  {people.filter((Persons) => Persons.online).length}
                </span>
              )}

              {filter.id === "new" && (
                <span className="filter-chip-count">
                  {
                    people.filter((Persons) => Persons.meta === "New here")
                      .length
                  }
                </span>
              )}
            </button>
          ))}
        </div>

        {/* -----------------------------------------
            LOADING
        ------------------------------------------ */}

        {loading && (
          <div className="people-loading">
            <IonSpinner />

            <span>Finding people near you...</span>
          </div>
        )}

        {/* -----------------------------------------
            LOCATION LOADING
        ------------------------------------------ */}

        {locationLoading && !loading && (
          <div className="location-loading">
            <IonIcon icon={locationOutline} />

            <span>Updating your location...</span>
          </div>
        )}

        {/* -----------------------------------------
            EMPTY STATE
        ------------------------------------------ */}

        {!loading && filteredPeople.length === 0 && (
          <div className="people-empty">
            <IonIcon icon={personCircleOutline} />

            <h2>No people found</h2>

            <p>Try increasing your search radius or check again later.</p>

            <button onClick={fetchNearbyPeople}>Try again</button>
          </div>
        )}

        {/* -----------------------------------------
            PROFILE GRID
        ------------------------------------------ */}

        {!loading && filteredPeople.length > 0 && (
          <IonGrid className="people-grid">
            <IonRow>
              {filteredPeople.map((Persons) => (
                <IonCol size="6" key={Persons.publicId}>
                  <div
                    className="people-card"
                    onClick={() => handleProfileClick(Persons)}
                  >
                    {/* PROFILE IMAGE */}

                    <div className="people-card-avatar">
                      {Persons.profilePhoto ? (
                        <img src={Persons.profilePhoto} alt={Persons.name} />
                      ) : (
                        <IonIcon icon={personCircleOutline} />
                      )}
                    </div>

                    {/* ONLINE */}

                    {Persons.online && (
                      <span
                        className="people-card-online-dot"
                        aria-hidden="true"
                      />
                    )}

                    {/* CHAT BUTTON */}

                    <button
                      className="people-card-wave"
                      aria-label={`Message ${Persons.name}`}
                      onClick={(event) => {
                        event.stopPropagation();

                        handleChat(Persons);
                      }}
                    >
                      <IonIcon icon={chatbubbleEllipsesOutline} />
                    </button>

                    {/* PROFILE INFO */}

                    <div className="people-card-info">
                      <div className="people-card-name-row">
                        <span className="people-card-name">
                          {Persons.name}, {Persons.age}
                        </span>

                        {Persons.verified && (
                          <IonIcon
                            icon={checkmarkCircle}
                            className="people-card-verified"
                          />
                        )}
                      </div>

                      <span className="people-card-meta">
                        {Persons.online
                          ? "Active now"
                          : Persons.meta || "Offline"}
                      </span>

                      <span className="people-card-distance">
                        📍 {Persons.distanceKm.toFixed(1)} km away
                      </span>
                    </div>
                  </div>
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>
        )}

        {/* -----------------------------------------
            SEE ALL
        ------------------------------------------ */}

        {!loading && filteredPeople.length > 0 && (
          <div className="people-cta-wrap">
            <button className="people-cta" onClick={fetchNearbyPeople}>
              <IonIcon icon={refreshOutline} />
              Refresh nearby people
            </button>
          </div>
        )}

        {/* -----------------------------------------
            PULL TO REFRESH
        ------------------------------------------ */}

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* -----------------------------------------
            TOAST
        ------------------------------------------ */}

        <IonToast
          isOpen={toastMessage.length > 0}
          message={toastMessage}
          duration={3000}
          onDidDismiss={() => setToastMessage("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default PeoplePage;
