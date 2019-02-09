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



const PATH_BASE = 'https://fpl-spring-boot.herokuapp.com/'
const PATH_LEAGUE = '/league/670123'
const CURRENT_GAMEWEEK_EVENT = '/event/'
const CURRENT_GAMEWEEK = '/currentGameweek'

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
    this.loadCurrentGameweekPointsForEachUser = this.loadCurrentGameweekPointsForEachUser.bind(this);
    this.loadCurrentGameweekPicksForEachLeagueMember = this.loadCurrentGameweekPicksForEachLeagueMember.bind(this);
    this.calculateCurrentGameweekScoreForEachLeagueMember = this.calculateCurrentGameweekScoreForEachLeagueMember.bind(this);
    this.state = {
      currentGameweek: null,
      currentGameweekPicks: {},
      currentGameweekPoints: null,
      currentGameweek: {},
      currentGameweekEvent: {},
      userCurrentGameweekMap: {},
      lastGameweekScore: {},
      league: {}
    };
  }

  setCurrentGameweekPicksForEachLeagueMember(currentGameweekPicks, i){
    var tempState = this.state.league;
      tempState.standings.results[i]["currentGameweekPicks"] = currentGameweekPicks;
      this.setState({ league: tempState })
      console.log(this.state);
  }

  loadCurrentGameweekPicksForEachLeagueMember(id, i){
    return fetch(`${PATH_BASE}` + '/entry/' + id + '/' + this.state.currentGameweek.currentGameweek)
    .then(response => response.json())
    .then(result => this.setCurrentGameweekPicksForEachLeagueMember(result, i))
    .then(result => this.calculateCurrentGameweekScoreForEachLeagueMember(i))
    .catch(error => console.log(error));
  }

  calculateCurrentGameweekScoreForEachLeagueMember(j){
    var gameweekScore = 0;
    for(var i = 0; i < 11; i++){
      var pick = this.state.league.standings.results[j].currentGameweekPicks.picks[i];
      var points = this.state.currentGameweekEvent.elements[pick.element].stats.total_points;
      gameweekScore += points * pick.multiplier;
    }
    var tempState = this.state.league;
    tempState.standings.results[j]["current_gameweek_points"] = gameweekScore;
    this.setState({ league: tempState })
    console.log("Gameweek score is " + gameweekScore);
  }

  loadCurrentGameweekPointsForEachUser(){
    for (var i = 0; i < this.state.league.standings.results.length; i++) {
      this.loadCurrentGameweekPicksForEachLeagueMember(this.state.league.standings.results[i].entry, i);
      // this.calculateCurrentGameweekScoreForEachLeagueMember(this.state.league.standings.results[i].entry);
    }
  }

  async loadLeagueData() {
    let leagueDataResponse = await fetch(`${PATH_BASE}${PATH_LEAGUE}`);
    let league = await leagueDataResponse.json();
    this.setState({ league });
  }

  calculateTableValues() {
    this.loadLeagueData()
      .then(this.loadCurrentGameweekPointsForEachUser)
  }

  setCurrentGameweekNumber(currentGameweek){
    this.setState({currentGameweek})
  }

  setCurrentGameweekEvent(currentGameweekEvent){
    this.setState({currentGameweekEvent})
  }

  async preload(){
    let currentGameweekNumberResponse = await fetch(`${PATH_BASE}${CURRENT_GAMEWEEK}`);
    let currentGameweekNumber = await currentGameweekNumberResponse.json();
    this.setCurrentGameweekNumber(currentGameweekNumber);

    let currentGameweekEventResponse = await fetch(`${PATH_BASE}${CURRENT_GAMEWEEK_EVENT}` + this.state.currentGameweek.currentGameweek);
    let currentGameweekEvent = await currentGameweekEventResponse.json();
    this.setCurrentGameweekEvent(currentGameweekEvent);
  }

  componentDidMount() {
    this.preload();
  }

  searchButton() {
    return (
      <SearchBar
        onChange={() => console.log(this.state)}
        onRequestSearch={() => this.calculateTableValues()}
        style={{
          margin: '0 auto',
          maxWidth: 800,
        }}
      />
    );
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
                    <TableCell numeric>{item.total - item.event_total}</TableCell>
                    <TableCell numeric>{item.current_gameweek_points}</TableCell>
                    <TableCell numeric>{item.total - item.event_total + item.current_gameweek_points}</TableCell>
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