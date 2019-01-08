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
import TextField from '@material-ui/core/TextField';
import SearchBar from 'material-ui-search-bar'



const PATH_BASE = 'http://localhost:8080'
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

   bloadCurrentGameWeekPoints() {
    console.log("Loading current gameweek points")
    fetch("http://localhost:8080/event/10", {
      headers: {
        "X-Requested-With": "true"
      },
    })
      .then(response => response.json())
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
      .then(result => this.loadCurrentGameWeekPoints())
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