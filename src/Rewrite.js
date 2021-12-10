import React, { Component } from "react";
import SearchBar from "material-ui-search-bar";
import Button from "@material-ui/core/Button";
import { AgGridColumn, AgGridReact } from "ag-grid-react";
import "./ag-grid.css";
import "./ag-theme-alpine.css";
import "./style.css";

import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-alpine-dark.css";
import _ from "lodash";

const PATH_BASE = "http://localhost:8080/";
const PATH_LEAGUE = "/league/";
const PATH_ENTRY = "/entry/";
const CURRENT_GAMEWEEK_EVENT = "/event/";
const FIXTURES = "/fixtures/";
const EVENT_STATUS = "/event-status/";
const ABOUT = "about";
const TRANSFERS = "/transfers/";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentGameweek: {},
      fixtures: {},
      about: {},
      event: {},
      leagueId: null,
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

  async search() {
    this.setState({ loaded: false });
    const leagueResponse = await fetch(
      `${PATH_BASE}${PATH_LEAGUE}` + this.state.leagueId
    );
    const league = await leagueResponse.json();
    this.setState({ league: league });

    const entryMap = {};

    const settings = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(_.map(league.standings.results, "entry")),
    };

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

  randomButton() {
    return <Button variant="contained">Default</Button>;
  }

  searchButton() {
    return (
      <SearchBar
        placeholder={this.state.leagueId}
        value={this.state.value}
        onChange={(query) => {
          this.setState({ leagueId: query });
        }}
        onRequestSearch={() => this.search()}
        style={{
          margin: "5 5 5 5",
          width: "50%",
        }}
      />
    );
  }

  onGridReady = (params) => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
    this.gridApi.sizeColumnsToFit();
  };

  render() {
    var gridOptions = {
      context: {
        state: this.state,
      },
    };
    return (
      <div className="body">
        <div className="searchBar">
          <SearchBar
            placeholder={this.state.leagueId}
            value={this.state.value}
            onChange={(query) => {
              this.setState({ leagueId: query });
            }}
            onRequestSearch={() => this.search()}
            style={{
              margin: "5 5 5 5",
              width: "100%",
            }}
          />
        </div>
        <div className="grid">
          {this.state.loaded ? (
            <div>
              <div className="toolbar"></div>
              <div className="ag-theme-alpine-dark">
                <AgGridReact
                  gridOptions={gridOptions}
                  rowData={this.state.league.standings.results}
                  domLayout={"autoHeight"}
                  onGridReady={this.onGridReady}
                >
                  <AgGridColumn field="rank" headerName="Rank"></AgGridColumn>
                  <AgGridColumn
                    field="last_rank"
                    headerName="Previous Rank"
                  ></AgGridColumn>
                  <AgGridColumn
                    cellRenderer={flagRenderer}
                    field="player_name"
                    headerName="Player"
                    filter="agTextColumnFilter"
                  ></AgGridColumn>
                  <AgGridColumn
                    field="entry_name"
                    headerName="Team Name"
                    filter="agTextColumnFilter"
                  ></AgGridColumn>
                  <AgGridColumn
                    field="total"
                    headerName="Total Points"
                    sortable={true}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="current_gameweek_points"
                    headerName="GW Points"
                    sortable={true}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="captain"
                    headerName="Captain"
                    valueGetter={getCaptain}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="vice_captain"
                    headerName="Vice Captain"
                    valueGetter={getViceCaptain}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="transfersout"
                    headerName="Transfers Out"
                    valueGetter={getTransfersOut}
                  ></AgGridColumn>
                  <AgGridColumn
                    field="transfersIn"
                    headerName="Transfers In"
                    valueGetter={getTransfersIn}
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

function createApp(props) {
  return new App(props);
}

function flagRenderer(params) {
  const playerId = params.data.entry;
  const country =
    params.context.state.playerPicks[playerId].metadata
      .player_region_iso_code_short;
  console.log(params.value + " : " + country);
  const element = document.createElement("span");
  const imageElement = document.createElement("img");
  imageElement.width = 24;
  imageElement.height = 24;
  imageElement.src = "/flags/" + country + ".svg";
  imageElement.style.cssText =
    "margin: 0; position: absolute; top: 50%; -ms-transform: translateY(-50%); transform: translateY(-50%);padding-left:10px";

  element.appendChild(document.createTextNode(params.value));
  element.appendChild(imageElement);
  return element;
}

function getCaptain(params) {
  const captain_id = _.find(params.data.player_pick.picks, {
    is_vice_captain: true,
  }).element;
  return _.find(params.context.state.about.elements, { id: captain_id })
    .web_name;
}

function getViceCaptain(params) {
  const captain_id = _.find(params?.data?.player_pick?.picks, {
    is_vice_captain: true,
  }).element;
  return _.find(params?.context?.state?.about?.elements, { id: captain_id })
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

export default App;
