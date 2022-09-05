import React, { Component } from "react";
import { AgGridColumn, AgGridReact } from "ag-grid-react";
import "./ag-grid.css";
import "./ag-theme-alpine.css";
import "./style.css";

import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-alpine-dark.css";
import _ from "lodash";
import { withRouter } from "react-router";
import CircularProgress from "@mui/material/CircularProgress";
import { pickBy, identity } from "lodash";
import SockJS from "sockjs-client";
import webstomp from "webstomp-client";
import { LeagueTable } from "./leagueTable";
import hash from "object-hash";

import CreatableSelect from "react-select/creatable";
const PATH_BASE = "https://fpl-service.fly.dev/";
// const PATH_BASE = "http://localhost:8080/";
const PATH_LEAGUE = "league/";
const PATH_ENTRY = "entry/";
const CURRENT_GAMEWEEK_EVENT = "event/";
const FIXTURES = "fixtures/";
const EVENT_STATUS = "event-status/";
const ABOUT = "about";
const TRANSFERS = "transfers/";

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
      currentCount: 0,
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
      const date = new Date(value.date);
      value["year"] = date.getUTCFullYear();
      value["month"] = date.getUTCMonth();
      value["day"] = date.getUTCDate();
    });
    this.setState({ eventStatus: eventStatus });
    this.setState({
      hasTransferPriceBeenPaid:
        _.find(eventStatus.status, { points: "r" }) !== undefined,
    });
  }

  async getEvent() {
    const eventResponse = await fetch(
      `${PATH_BASE}${CURRENT_GAMEWEEK_EVENT}` + this.state.currentGameweek.id
    );
    const event = await eventResponse.json();
    this.setState({ event: event, eventHash: hash(event) });
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
    const league = await this.getLeague();

    const postRequestSettings = this.getPostSettings(league);
    const playerPicks = await this.getPlayerPicks(postRequestSettings);
    const transfers = await this.getTransfers(postRequestSettings);
    const entries = await this.getEntries(postRequestSettings);

    this.enrichAndSetPlayerPicks(playerPicks, transfers, entries);

    this.calculatePoints();

    this.setState({ loaded: true });
  }

  calculatePoints() {
    _.chain(this.state.playerPicks)
      .forEach((playerPick, playerId) => {
        let totalPoints = 0;
        _.chain(playerPick.picks)
          .forEach((pick) => {
            if (pick.position <= 11) {
              const element = _.find(this.state.event.elements, {
                id: pick.element,
              });

              const fixtures = this.getFixturesForPlayer(pick);

              if (!_.isEmpty(fixtures)) {
                var bonus = 0;
                var livePlayerPoints = 0;
                _.forEach(fixtures, (fixture) => {
                  const date = new Date(fixture.kickoff_time);
                  const year = date.getUTCFullYear();
                  const month = date.getUTCMonth();
                  const day = date.getUTCDate();
                  if (fixture.started) {
                    const eventStatus = _.find(this.state.eventStatus.status, {
                      day: day,
                    });
                    if (eventStatus.points !== "r") {
                      livePlayerPoints =
                        element.stats.total_points * pick.multiplier;
                    }
                    if (!eventStatus.bonus_added) {
                      bonus = bonus + (this.calculateLiveBonus(fixture, pick) * pick.multiplier);
                    }
                  }
                });
                if(livePlayerPoints !== 0){
                  console.log(playerId + ' ' + _.find(this.state.about.elements, { id: pick.element })
                .web_name + ': '+ livePlayerPoints + ' bonus: ' + bonus)
                }
                
                totalPoints = totalPoints + bonus + livePlayerPoints;
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
                {
                  

                  if (res.entry == playerId) {
                    console.log(res.player_name + ' live total = ' + totalPoints);
                    console.log(res.player_name + ' gw non live total = ' + res.event_total);
                    return {
                        ...res,
                        current_gameweek_points: totalPoints + res.event_total,
                        player_pick: playerPick,
                        live_total: res.total +
                          totalPoints -
                          (prevState.hasTransferPriceBeenPaid
                            ? 0
                            : playerPick.entry_history.event_transfers_cost),
                      };
                  } else {
                    return res;
                  }
                }
              ),
            },
          },
        }));
      })
      .value();
  }

  getFixturesForPlayer(pick) {
    return _.filter(
      this.state.fixtures,
      (fixture) =>
        fixture.team_h === pick.player.team ||
        fixture.team_a === pick.player.team
    );
  }

  enrichAndSetPlayerPicks(playerPicks, transfers, entries) {
    const entryMap = {};
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
      entryMap[playerPick.user_id]["metadata"] = entries[playerPick.user_id];
    });

    this.setState({ playerPicks: entryMap });
  }

  async getEntries(settings) {
    const entryResponse = await fetch(`${PATH_BASE}${PATH_ENTRY}`, settings);
    const entry = await entryResponse.json();
    return entry;
  }

  async getTransfers(settings) {
    const transfersResponse = await fetch(`${PATH_BASE}${TRANSFERS}`, settings);
    const transfers = await transfersResponse.json();
    return transfers;
  }

  async getPlayerPicks(settings) {
    const playerPicksResponse = await fetch(
      `${PATH_BASE}${PATH_ENTRY}` + this.state.currentGameweek.id,
      settings
    );
    const playerPicks = await playerPicksResponse.json();
    return playerPicks;
  }

  async getLeague() {
    this.setState({ loaded: false });
    let leagueId = this.state.leagueId;
    const leagueResponse = await fetch(
      `${PATH_BASE}${PATH_LEAGUE}` + leagueId + "/" + 1
    );
    const league = await leagueResponse.json();
    if (!localStorage.getItem("leagues")) {
      localStorage.setItem("leagues", JSON.stringify({}));
    }
    if (leagueResponse.ok) {
      const localStorageLeagues = JSON.parse(localStorage.getItem("leagues"));
      localStorageLeagues[leagueId] = league;
      localStorage.setItem(
        "leagues",
        JSON.stringify(pickBy(localStorageLeagues, identity))
      );
    }

    this.setState({ league: league });
    return league;
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

  calculateLiveBonus(fixture, pick) {
    const homeBps = _.chain(fixture.stats).find({ identifier: "bps" }).value()[
      "h"
    ];
    const awayBps = _.chain(fixture.stats).find({ identifier: "bps" }).value()[
      "a"
    ];
    const allBps = _.reverse(_.sortBy(_.concat(homeBps, awayBps), "value"));
    const arrayIndex = _.findIndex(allBps, { element: pick.element });
    if (arrayIndex === 0) return 3;
    if (arrayIndex === 1) {
      return allBps[1].value === allBps[0].value ? 3 : 2;
    }
    if (arrayIndex === 2) {
      if (allBps[2].value === allBps[0].value) return 3;
      return allBps[2].value === allBps[1].value ? 2 : 1;
    }
    return 0;
  }

  timer() {
    this.setState({
      currentCount: this.state.currentCount + 1,
    });
  }

  componentDidMount() {
    const connection = new SockJS(
      "https://fpl-service.fly.dev/websocket"
    );
    // const connection = new SockJS(
    //   "http://localhost:8080/websocket"
    // );
    const stompClient = webstomp.over(connection);
    stompClient.debug = () => {};
    stompClient.connect("", "", (frame) => {
      stompClient.subscribe("/notification/message", (greeting) => {
        
        const eventData = JSON.parse(greeting.body);
        var start = new Date().getTime();
        const newHash = hash(eventData);
        var end = new Date().getTime();
          var time = end - start;
          console.log("Execution time: " + time);
        if (eventData && this.state.loaded) {
          this.setState({
            currentCount: 0,
          });
          if(newHash !== this.state.eventHash){
            this.calculatePoints();
            this.setState({ event: eventData });
          }
                
          
          
        }
      });
    });
    this.preload();
    this.intervalId = setInterval(this.timer.bind(this), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.intervalId);
  }

  onTagsChange = (event) => {
    const leagueId = !isNaN(event.label)
      ? event.label
      : _.chain(JSON.parse(localStorage.getItem("leagues")))
          .map("league")
          .find({ name: event.label })
          .value()["id"];
    this.props.history.push("/league/" + leagueId);
    this.setState(
      {
        leagueId: !isNaN(event.label)
          ? event.label
          : _.chain(JSON.parse(localStorage.getItem("leagues")))
              .map("league")
              .find({ name: event.label })
              .value()["id"],
      },
      () => {
        if (this.state.leagueId) {
          this.search();
        }
      }
    );
  };

  handleCreate = (leagueId) => {
    this.props.history.push("/league/" + leagueId);
    this.setState(
      {
        leagueId: leagueId,
      },
      () => {
        if (this.state.leagueId) {
          this.search();
        }
      }
    );
  };

  createOption = (label) => ({
    label,
    value: label?.toLowerCase().replace(/\W/g, ""),
  });

  render() {
    const createOption = (label) => ({
      label,
      value: label?.toLowerCase().replace(/\W/g, ""),
    });

    const leagueNames = _.chain(JSON.parse(localStorage.getItem("leagues")))
      .map("league")
      .map("name")
      .map(createOption)
      .value();

    const chosenLeagueName = this.state.loaded
      ? createOption(this.state.league.league.name)
      : "";

    const styles = {
      control: (base) => ({
        ...base,
        fontFamily:
          "apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen-Sans, Ubuntu, Cantarell, Helvetica Neue, sans-serif;",
      }),
      menu: (base) => ({
        ...base,
        fontFamily:
          "apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen-Sans, Ubuntu, Cantarell, Helvetica Neue, sans-serif;",
      }),
    };

    return (
      <div id="main" className="main">
        <div className="searchBar">
          <CreatableSelect
            styles={styles}
            onChange={this.onTagsChange}
            onCreateOption={this.handleCreate}
            options={leagueNames}
            value={chosenLeagueName}
            formatCreateLabel={(userInput) => `Search for ${userInput}`}
          />
        </div>
        {this.state.loaded ? (
          <LeagueTable fpldata={this.state} />
        ) : (
          <div className="loading">
            {" "}
            <CircularProgress />
          </div>
        )}
      </div>
    );
  }
}

export default withRouter(League);
