import React, { Component } from "react";
import { BrowserRouter as Router, Route, Link, Switch, withRouter } from "react-router-dom";

import League from "./Components/league";

function App() {
  return (
    <div className="App">
      <Router>
        <Switch>
          <Route path="/" element={<h1>Home Page</h1>} />
          <Route path="league/:leagueId?" element={<League />} />
          <Route path="league/" element={<League />} />
        </Switch>
      </Router>
    </div>
  );
}

export default App;
