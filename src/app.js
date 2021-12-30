import React from "react";
import { Route, Switch } from "react-router-dom";
import Products from "./Components/Products";
import League from "./Components/league";
import "./Components/style.css";

const Home = () => <div></div>;

export default function App() {
  return (
    // <div>
        <Switch>
          <Route exact path="/">
            <Home />
          </Route>
          <Route path="/products">
            <Products />
          </Route>
          <Route path="/league/:leagueId?">
            <League />
          </Route>
        </Switch>
    // </div>
  );
}
