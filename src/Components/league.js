import React, { Component } from "react";
import { AgGridColumn, AgGridReact } from "ag-grid-react";
import "./ag-grid.css";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Autocomplete from "@mui/material/Autocomplete";
import "./ag-theme-alpine.css";
import "./style.css";

import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-alpine-dark.css";
import _ from "lodash";
import FreeSolo from "./Search";
import { withRouter } from "react-router";
import { pickBy, identity } from 'lodash'

const PATH_BASE = "http://localhost:8080/";
const PATH_LEAGUE = "/league/";
const PATH_ENTRY = "/entry/";
const CURRENT_GAMEWEEK_EVENT = "/event/";
const FIXTURES = "/fixtures/";
const EVENT_STATUS = "/event-status/";
const ABOUT = "about";
const TRANSFERS = "/transfers/";

class League extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentGameweek: {},
      fixtures: {},
      about: {},
      event: {},
      leagueId: this.props.match.params.leagueId,
      league: {},
      playerPicks: {},
      loaded: false,
      eventStatus: {},
    };
  }

  async preload() {
    await this.getCurrentGameweek();
    await this.getEvent();
    await this.getEventStatus();
    await this.getFixtures();
    if (this.state.leagueId) {
      await this.search();
    }
  }

  async getFixtures() {
    const fixtureResponse = await fetch(
      `${PATH_BASE}${FIXTURES}` + this.state.currentGameweek.id
    );
    const fixtures = await fixtureResponse.json();
    this.setState({ fixtures: fixtures });
  }

  async getEventStatus() {
    const eventStatusResponse = await fetch(`${PATH_BASE}${EVENT_STATUS}`);
    const eventStatus = await eventStatusResponse.json();
    _.forEach(eventStatus.status, (value) => {
      value["jsDate"] = new Date(value.date);
    });
    this.setState({ eventStatus: eventStatus });
  }

  async getEvent() {
    const eventResponse = await fetch(
      `${PATH_BASE}${CURRENT_GAMEWEEK_EVENT}` + this.state.currentGameweek.id
    );
    const event = await eventResponse.json();
    this.setState({ event: event });
  }

  async getCurrentGameweek() {
    const aboutResponse = await fetch(`${PATH_BASE}${ABOUT}`);
    const about = await aboutResponse.json();
    var currentGameweek = _.filter(about.events, {
      is_current: true,
    })[0];

    this.setState({ about: about, currentGameweek: currentGameweek });
    return currentGameweek;
  }

  async search(event) {
    this.setState({ loaded: false });
    let leagueId = this.state.leagueId;
    const leagueResponse = await fetch(
      `${PATH_BASE}${PATH_LEAGUE}` + leagueId + "/" + 1
    );
    const league = await leagueResponse.json();
    if (!localStorage.getItem("leagues")) {
      localStorage.setItem("leagues", JSON.stringify({}));
    }
    if(leagueResponse.ok){
      const localStorageLeagues = JSON.parse(localStorage.getItem("leagues"));
      localStorageLeagues[leagueId] = league;
      localStorage.setItem("leagues", JSON.stringify(pickBy(localStorageLeagues, identity)));
    }
    
    this.setState({ league: league });

    const leagues = JSON.parse(localStorage.getItem("leagues"));

    const entryMap = {};

    const settings = this.getPostSettings(league);

    const playerPicksResponse = await fetch(
      `${PATH_BASE}${PATH_ENTRY}` + this.state.currentGameweek.id,
      settings
    );
    const playerPicks = await playerPicksResponse.json();

    const transfersResponse = await fetch(`${PATH_BASE}${TRANSFERS}`, settings);
    const transfers = await transfersResponse.json();

    const entryResponse = await fetch(`${PATH_BASE}${PATH_ENTRY}`, settings);
    const entry = await entryResponse.json();

    _.forEach(playerPicks, (playerPick) => {
      _.chain(playerPick.picks)
        .forEach((pick, key) => {
          const player = _.find(this.state.about.elements, {
            id: pick.element,
          });
          playerPick.picks[key]["player"] = player;
        })
        .value();
      entryMap[playerPick.user_id] = playerPick;
      entryMap[playerPick.user_id]["transfers"] = transfers[playerPick.user_id];
      entryMap[playerPick.user_id]["metadata"] = entry[playerPick.user_id];
    });

    this.setState({ playerPicks: entryMap });

    _.chain(this.state.playerPicks)
      .forEach((playerPick, playerId) => {
        let totalPoints = 0;
        _.chain(playerPick.picks)
          .forEach((pick) => {
            if (pick.position <= 11) {
              const temp = this.state;
              const element = _.find(this.state.event.elements, {
                id: pick.element,
              });
              const fixture = _.find(temp.fixtures, {
                team_h: pick.player.team,
              })
                ? _.find(temp.fixtures, { team_h: pick.player.team })
                : _.find(temp.fixtures, { team_a: pick.player.team });

              if (fixture) {
                const fixtureKickOffTime = new Date(fixture.kickoff_time);
                fixtureKickOffTime.setHours(0, 0, 0, 0);

                if (fixture.started) {
                  const homeBps = _.chain(fixture.stats)
                    .find({ identifier: "bps" })
                    .value()["h"];
                  const awayBps = _.chain(fixture.stats)
                    .find({ identifier: "bps" })
                    .value()["a"];
                  const allBps = _.reverse(
                    _.sortBy(_.concat(homeBps, awayBps), "value")
                  );
                  const eventStatus = _.find(temp.eventStatus.status, {
                    jsDate: fixtureKickOffTime,
                  });
                  var liveBonus = 0;
                  if (!eventStatus.bonus_added) {
                    liveBonus = this.calculateLiveBonus(allBps, pick);
                  }

                  totalPoints =
                    totalPoints +
                    liveBonus +
                    element.stats.total_points * pick.multiplier;
                }
              }
            }
          })
          .value();
        this.setState((prevState) => ({
          league: {
            ...prevState.league,
            standings: {
              ...prevState.league.standings,
              results: prevState.league.standings.results.map((res) =>
                res.entry == playerId
                  ? {
                      ...res,
                      current_gameweek_points: totalPoints,
                      player_pick: playerPick,
                      live_total:
                        res.total +
                        totalPoints -
                        playerPick.entry_history.event_transfers_cost,
                    }
                  : res
              ),
            },
          },
        }));
      })
      .value();

    this.setState({ loaded: true });
  }

  getPostSettings(league) {
    return {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(_.map(league.standings.results, "entry")),
    };
  }

  calculateLiveBonus(allBps, pick) {
    const arrayIndex = _.findIndex(allBps, { element: pick.element });
    if (arrayIndex === 0) return 3;
    if (arrayIndex === 1) {
      return allBps[1].value === allBps[0].value ? 3 : 2;
    }
    if (arrayIndex === 2) {
      if (allBps[2].value === allBps[0].value) return 3;
      return allBps[2].value === allBps[1].value ? 2 : 2;
    }
    return 0;
  }

  componentDidMount() {
    this.preload();
  }

  onGridReady = (params) => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
  };

  onTagsChange = (event, values) => {
    this.setState(
      {
        leagueId: !isNaN(values)
          ? values
          : _.chain(JSON.parse(localStorage.getItem("leagues")))
              .map("league")
              .find({ name: values })
              .value()["id"],
      },
      () => {
        // This will output an array of objects
        // given by Autocompelte options property.
        if(this.state.leagueId){
          this.search();
        }
      }
    );
  };

  render() {
    var gridOptions = {
      context: {
        state: this.state,
      },
    };
    const defaultColDef = {
      resizable: true,
      sortable: true,
    };
    const leagueNames = _.chain(JSON.parse(localStorage.getItem("leagues")))
      .map("league")
      .map("name")
      .value();

    return (
      <div className="body">
        <div className="searchBar">
          <Stack>
            <Autocomplete
              id="free-solo-demo"
              freeSolo
              onChange={this.onTagsChange}
              options={leagueNames}
              renderInput={(params) => (
                <TextField {...params} label="League ID" />
              )}
            />
          </Stack>
        </div>
        <div className="grid">
          {this.state.loaded ? (
            <div>
              {/* <div className="toolbar"></div> */}
              <div className="ag-theme-alpine-dark">
                <AgGridReact
                  gridOptions={gridOptions}
                  rowData={_.sortBy(this.state.league.standings.results, [
                    "live_total",
                  ]).reverse()}
                  domLayout={"autoHeight"}
                  onGridReady={this.onGridReady}
                  defaultColDef={defaultColDef}
                >
                  <AgGridColumn
                    field="rank"
                    headerName="Rank"
                    cellRenderer={getRowIndex}
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="last_rank"
                    headerName="Old Rank"
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="change"
                    headerName="Change"
                    cellRenderer={getChange}
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="entry_name"
                    headerName="Team Name"
                    filter="agTextColumnFilter"
                    flex={2}
                  ></AgGridColumn>
                  <AgGridColumn
                    cellRenderer={flagRenderer}
                    field="player_name"
                    headerName="Player"
                    filter="agTextColumnFilter"
                    flex={3}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="live_total"
                    headerName="Total Points"
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="current_gameweek_points"
                    headerName="GW Points"
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="captain"
                    headerName="Captain"
                    valueGetter={getCaptain}
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="vice_captain"
                    headerName="Vice"
                    valueGetter={getViceCaptain}
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="hits"
                    headerName="Hits"
                    valueGetter={getHits}
                    flex={1}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="transfersout"
                    headerName="Transfers Out"
                    valueGetter={getTransfersOut}
                    flex={3}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="transfersIn"
                    headerName="Transfers In"
                    valueGetter={getTransfersIn}
                    flex={3}
                  ></AgGridColumn>
                </AgGridReact>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

function flagRenderer(params) {
  const playerId = params.data.entry;
  const country =
    params.context.state.playerPicks[playerId].metadata
      .player_region_iso_code_short;
  const element = document.createElement("span");
  const imageElement = document.createElement("img");

  imageElement.src = window.location.origin + "/" + country + ".svg";
  imageElement.width = 24;
  imageElement.height = 24;
  imageElement.style.cssText =
    "margin: 0; position: absolute; top: 50%; -ms-transform: translateY(-50%); transform: translateY(-50%);padding-left:10px";

  element.appendChild(document.createTextNode(params.value));
  element.appendChild(imageElement);
  return element;
}

function getCaptain(params) {
  const captain_id = _.find(params.data.player_pick.picks, {
    is_captain: true,
  }).element;
  return _.find(params.context.state.about.elements, { id: captain_id })
    .web_name;
}

function getRowIndex(params) {
  return params.node.rowIndex + 1;
}

function getChange(params) {
  const element = document.createElement("span");
  const imageElement = document.createElement("img");

  const positionChange = params.data.last_rank - (params.node.rowIndex + 1);
  if (positionChange !== 0) {
    var div = document.createElement("div");
    div.innerText = Math.abs(positionChange);
    div.style.cssText =
      "margin: 0; position: absolute; top: 50%; -ms-transform: translateY(-50%); transform: translateY(-50%);padding-left:40px";
    element.appendChild(div);
  }

  imageElement.width = 24;
  imageElement.height = 24;
  imageElement.style.cssText =
    "margin: 0; position: absolute; top: 50%; -ms-transform: translateY(-50%); transform: translateY(-50%);padding-left:10px";

  if (positionChange > 0) {
    imageElement.src = window.location.origin + "/" + "up-arrow.svg";
  } else if (positionChange < 0) {
    imageElement.src = window.location.origin + "/" + "down-arrow.svg";
  } else {
    imageElement.src = window.location.origin + "/" + "equals.svg";
  }
  element.appendChild(imageElement);

  return element;
}

function getHits(params) {
  return params.data.player_pick.entry_history.event_transfers_cost;
}

function getViceCaptain(params) {
  const captain_id = _.find(params.data.player_pick.picks, {
    is_vice_captain: true,
  }).element;
  return _.find(params.context.state.about.elements, { id: captain_id })
    .web_name;
}

function getTransfersIn(params) {
  return _.chain(params.data.player_pick.transfers)
    .filter({ event: params.context.state.currentGameweek.id })
    .map("element_in")
    .map((x) => _.find(params.context.state.about.elements, { id: x }).web_name)
    .value()
    .join(", ");
}

function getTransfersOut(params) {
  return _.chain(params.data.player_pick.transfers)
    .filter({ event: params.context.state.currentGameweek.id })
    .map("element_out")
    .map((x) => _.find(params.context.state.about.elements, { id: x }).web_name)
    .value()
    .join(", ");
}

const top100Films = [
  { title: "The Shawshank Redemption", year: 1994 },
  { title: "The Godfather", year: 1972 },
  { title: "The Godfather: Part II", year: 1974 },
  { title: "The Dark Knight", year: 2008 },
  { title: "12 Angry Men", year: 1957 },
  { title: "Schindler's List", year: 1993 },
  { title: "Pulp Fiction", year: 1994 },
  {
    title: "The Lord of the Rings: The Return of the King",
    year: 2003,
  },
  { title: "The Good, the Bad and the Ugly", year: 1966 },
  { title: "Fight Club", year: 1999 },
  {
    title: "The Lord of the Rings: The Fellowship of the Ring",
    year: 2001,
  },
  {
    title: "Star Wars: Episode V - The Empire Strikes Back",
    year: 1980,
  },
  { title: "Forrest Gump", year: 1994 },
  { title: "Inception", year: 2010 },
  {
    title: "The Lord of the Rings: The Two Towers",
    year: 2002,
  },
  { title: "One Flew Over the Cuckoo's Nest", year: 1975 },
  { title: "Goodfellas", year: 1990 },
  { title: "The Matrix", year: 1999 },
  { title: "Seven Samurai", year: 1954 },
  {
    title: "Star Wars: Episode IV - A New Hope",
    year: 1977,
  },
  { title: "City of God", year: 2002 },
  { title: "Se7en", year: 1995 },
  { title: "The Silence of the Lambs", year: 1991 },
  { title: "It's a Wonderful Life", year: 1946 },
  { title: "Life Is Beautiful", year: 1997 },
  { title: "The Usual Suspects", year: 1995 },
  { title: "Léon: The Professional", year: 1994 },
  { title: "Spirited Away", year: 2001 },
  { title: "Saving Private Ryan", year: 1998 },
  { title: "Once Upon a Time in the West", year: 1968 },
  { title: "American History X", year: 1998 },
  { title: "Interstellar", year: 2014 },
  { title: "Casablanca", year: 1942 },
  { title: "City Lights", year: 1931 },
  { title: "Psycho", year: 1960 },
  { title: "The Green Mile", year: 1999 },
  { title: "The Intouchables", year: 2011 },
  { title: "Modern Times", year: 1936 },
  { title: "Raiders of the Lost Ark", year: 1981 },
  { title: "Rear Window", year: 1954 },
  { title: "The Pianist", year: 2002 },
  { title: "The Departed", year: 2006 },
  { title: "Terminator 2: Judgment Day", year: 1991 },
  { title: "Back to the Future", year: 1985 },
  { title: "Whiplash", year: 2014 },
  { title: "Gladiator", year: 2000 },
  { title: "Memento", year: 2000 },
  { title: "The Prestige", year: 2006 },
  { title: "The Lion King", year: 1994 },
  { title: "Apocalypse Now", year: 1979 },
  { title: "Alien", year: 1979 },
  { title: "Sunset Boulevard", year: 1950 },
  {
    title:
      "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb",
    year: 1964,
  },
  { title: "The Great Dictator", year: 1940 },
  { title: "Cinema Paradiso", year: 1988 },
  { title: "The Lives of Others", year: 2006 },
  { title: "Grave of the Fireflies", year: 1988 },
  { title: "Paths of Glory", year: 1957 },
  { title: "Django Unchained", year: 2012 },
  { title: "The Shining", year: 1980 },
  { title: "WALL·E", year: 2008 },
  { title: "American Beauty", year: 1999 },
  { title: "The Dark Knight Rises", year: 2012 },
  { title: "Princess Mononoke", year: 1997 },
  { title: "Aliens", year: 1986 },
  { title: "Oldboy", year: 2003 },
  { title: "Once Upon a Time in America", year: 1984 },
  { title: "Witness for the Prosecution", year: 1957 },
  { title: "Das Boot", year: 1981 },
  { title: "Citizen Kane", year: 1941 },
  { title: "North by Northwest", year: 1959 },
  { title: "Vertigo", year: 1958 },
  {
    title: "Star Wars: Episode VI - Return of the Jedi",
    year: 1983,
  },
  { title: "Reservoir Dogs", year: 1992 },
  { title: "Braveheart", year: 1995 },
  { title: "M", year: 1931 },
  { title: "Requiem for a Dream", year: 2000 },
  { title: "Amélie", year: 2001 },
  { title: "A Clockwork Orange", year: 1971 },
  { title: "Like Stars on Earth", year: 2007 },
  { title: "Taxi Driver", year: 1976 },
  { title: "Lawrence of Arabia", year: 1962 },
  { title: "Double Indemnity", year: 1944 },
  {
    title: "Eternal Sunshine of the Spotless Mind",
    year: 2004,
  },
  { title: "Amadeus", year: 1984 },
  { title: "To Kill a Mockingbird", year: 1962 },
  { title: "Toy Story 3", year: 2010 },
  { title: "Logan", year: 2017 },
  { title: "Full Metal Jacket", year: 1987 },
  { title: "Dangal", year: 2016 },
  { title: "The Sting", year: 1973 },
  { title: "2001: A Space Odyssey", year: 1968 },
  { title: "Singin' in the Rain", year: 1952 },
  { title: "Toy Story", year: 1995 },
  { title: "Bicycle Thieves", year: 1948 },
  { title: "The Kid", year: 1921 },
  { title: "Inglourious Basterds", year: 2009 },
  { title: "Snatch", year: 2000 },
  { title: "3 Idiots", year: 2009 },
  { title: "Monty Python and the Holy Grail", year: 1975 },
];

export default withRouter(League);
