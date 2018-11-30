import React, { Component } from 'react';
import './App.css';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import SearchBar from 'material-ui-search-bar'

// const PATH_BASE = 'http://fantasy.premierleague.com/drf';
const PATH_BASE = 'http://localhost:8080'
// const PATH_LEAGUE = '/leagues-classic-standings/670123?phase=1&le-page=1&ls-page=1';
const PATH_LEAGUE = '/league/670123'
const PATH_GAMEWEEK = '/entry/4309204/event/'

const styles = theme => ({
  root: {
    width: '100%',
    marginTop: theme.spacing.unit * 3,
    overflowX: 'auto',
  },
  table: {
    minWidth: 700,
  },
});

class App extends Component {
  constructor(props) {
    super(props);
    this.getAllScores = this.getAllScores.bind(this);
    this.setPicks = this.setPicks.bind(this);
    this.calculateGameWeekScoreForEachLeagueMember = this.calculateGameWeekScoreForEachLeagueMember.bind(this);
    this.state = {
      currentGameweek: 10,
      currentGameweekPicks: {},
      curretGameweekPoints: null,
      currentGameweekEvent: {},
      userCurrentGameweekMap: {},
      lastGameweekScore: {},
      league: {}
    };
  }

  setPicks(userId, result) {
    var picks = result.picks;
    this.state.currentGameweekPicks[userId] = picks;
    console.log("Picks Loaded");
  }

  setLastWeekScore(userId, result) {
    this.state.lastGameweekScore[userId] = result.entry_history.total_points;
    for (var i = 0; i < this.state.league.standings.results.length; i++) {
      if (userId === this.state.league.standings.results[i].entry) {
        var tempState = this.state.league;

        tempState.standings.results[i]["last_gameweek_points"] = result.entry_history.total_points;
        this.setState({ league: tempState })
      }
    }
  }

  calculateGameWeekScoreForEachLeagueMember() {
    console.log("Calculate gameweek score for each league member")
    var gameweekScore = 0;
    console.log(this.state.currentGameweekPicks);
    for (const [key, value] of Object.entries(this.state.currentGameweekPicks)) {
      console.log("Getting all points for 15 players -------------")
      for (var i = 0; i < value.length - 4; i++) {
        var multiplier = value[i].multiplier;
        var points = this.state.curretGameweekPoints[value[i].element].stats.total_points;
        console.log("i is " + i + ", points are " + points + ", element is " + value[i].element)
        gameweekScore += (points) * multiplier;

      }
      this.state.league.standings.results
      for (var i = 0; i < this.state.league.standings.results.length; i++) {
        if (this.state.league.standings.results[i].entry == parseInt(key, 10)) {
          console.log(this.state.league.standings.results[i].entry_name);
        }
      }
      this.state.userCurrentGameweekMap[key] = gameweekScore;
      for (var i = 0; i < this.state.league.standings.results.length; i++) {
        if (parseInt(key) === this.state.league.standings.results[i].entry) {
          var tempState = this.state.league;

          tempState.standings.results[i]["current_gameweek_points"] = gameweekScore;
          this.setState({ league: tempState })
        }
      }
      console.log("Current gameweek score is " + gameweekScore);
      console.log("---------------------------------")
      gameweekScore = 0;
    }
  }

  loadCurrentGameweekEvent(currentGameWeek) {
    console.log("Loading current gameweek event.")
    fetch("https://fantasy.premierleague.com/drf/event/10/live", {
      headers: {
        "X-Requested-With": "true"
      },
    })
      .then(response => response.json())
      .then(result => this.setCurrentGameweekEvent(result))
      // .then(result => this.calculateGameWeekScoreForEachLeagueMember())
      .catch(error => console.log(error));
  }

  setCurrentGameweekEvent(currentGameweekEvent) {
    console.log(currentGameweekEvent);
    this.setState({ currentGameweekEvent: currentGameweekEvent })
  }

  loadCurrentGameWeekPoints() {
    console.log("Loading current gameweek points")
    fetch("https://fantasy.premierleague.com/drf/event/10/live", {
      headers: {
        "X-Requested-With": "true"
      },
    })
      .then(response => response.json())
      .then(result => this.setAllScores(result))
      .then(result => this.calculateGameWeekScoreForEachLeagueMember())
      .catch(error => console.log(error));
  }

  loadPreviousGameWeekPoints(element) {
    console.log("Loading previous gameweek points")
    fetch(`${PATH_BASE}` + '/entry/' + element.entry + '/event/9/picks', {
      headers: {
        "X-Requested-With": "true"
      },
    })
      .then(response => response.json())
      .then(result => this.setLastWeekScore(element.entry, result))
      .catch(error => console.log(error));
  }

  searchButton() {
    return (
      <SearchBar
        onChange={() => console.log('onChange')}
        onRequestSearch={() => this.calculateTableValues()}
        style={{
          margin: '0 auto',
          maxWidth: 800,
        }}
      />
    );
  }

  getAllScores(element) {
    console.log("Getting gameweek for " + element.entry_name);
    fetch(`${PATH_BASE}` + '/entry/' + element.entry + '/event/' + this.state.currentGameweek + '/picks')
      .then(response => response.json())
      .then(result => this.setPicks(element.entry, result))
      .catch(error => console.log(error));
  }

  setLeagueData(league) {
    var myMap = new Map()
    for (var i = 0; i < league.standings.results.length; i++) {
      myMap.set(league.standings.results[i].id, league.standings.results[i])
    }
    this.setState({ league });
  }

  calculateTableValues() {
    //first get league table
    var that = this;
    fetch(`${PATH_BASE}${PATH_LEAGUE}`)
      .then(response => response.json())
      .then(function(league) {
        console.log("Setting league data on state")
        that.setState({ league });
        console.log(that.state.league)
      })
      // .then(result => this.setLeagueData(result))
      // // .then(result => this.loadCurrentGameWeekPoints())
      .catch(error => console.log(error));
  }

  getLeagueData() {
    fetch(`${PATH_BASE}${PATH_LEAGUE}`)
      .then(response => response.json())
      .then(result => this.setLeagueData(result))
      // .then(result => this.loadCurrentGameWeekPoints())
      .catch(error => console.log(error));
  }

  componentDidMount() {
    this.loadCurrentGameweekEvent(10);
  }

  render() {
    if (this.state.league.standings == null) {
      return this.searchButton();
    }

    return (
      <div className="App">
        {this.searchButton()}
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Team Name</TableCell>
                <TableCell numeric>Player Name</TableCell>
                <TableCell numeric>Points Before Current Gameweek</TableCell>
                <TableCell numeric>Current Gameweek Points</TableCell>
                <TableCell numeric>Total Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {this.state.league.standings.results.map(item => {
                return (
                  <TableRow key={item.entry_name}>
                    <TableCell component="th" scope="row">
                      {item.entry_name}
                    </TableCell>
                    <TableCell numeric>{item.player_name}</TableCell>
                    <TableCell numeric>{item.last_gameweek_points}</TableCell>
                    <TableCell numeric>{item.current_gameweek_points}</TableCell>
                    <TableCell numeric>{item.current_gameweek_points + item.last_gameweek_points}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </div>)
      ;
  }
}

export default App;