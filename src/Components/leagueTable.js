import * as React from "react";
import { AgGridColumn, AgGridReact } from "ag-grid-react";
import "./ag-grid.css";
import "./ag-theme-alpine.css";
import "./style.css";

import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-alpine-dark.css";
import _ from "lodash";

export class LeagueTable extends React.Component {
  getHits(params) {
    return params.data.player_pick.entry_history.event_transfers_cost;
  }
  onGridReady = (params) => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
  };
  render() {
    var gridOptions = {
      context: {
        state: this.props.fpldata,
      },
    };
    const defaultColDef = {
      resizable: true,
      sortable: true,
      enableCellChangeFlash: true,
    };

    return (
      <div className="grid">
        <div>
          <div className="toolbar">
            <div className="counter">
              Last updated {this.props.fpldata.currentCount} seconds ago
            </div>
          </div>
          <div className="ag-theme-alpine-dark">
            <AgGridReact
              gridOptions={gridOptions}
              rowData={_.sortBy(this.props.fpldata.league.standings.results, [
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
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="last_rank"
                headerName="Old Rank"
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="change"
                headerName="Change"
                cellRenderer={getChange}
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="entry_name"
                headerName="Team Name"
                filter="agTextColumnFilter"
                flex={4}
              ></AgGridColumn>
              <AgGridColumn
                cellRenderer={flagRenderer}
                field="player_name"
                headerName="Player"
                filter="agTextColumnFilter"
                flex={5}
              ></AgGridColumn>
              <AgGridColumn
                field="live_total"
                headerName="Total Points"
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="current_gameweek_points"
                headerName="GW Points"
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="captain"
                headerName="Captain"
                valueGetter={getCaptain}
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="vice_captain"
                headerName="Vice"
                valueGetter={getViceCaptain}
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="hits"
                headerName="Hits"
                valueGetter={getHits}
                flex={2}
              ></AgGridColumn>
              <AgGridColumn
                field="transfersout"
                headerName="Transfers Out"
                valueGetter={getTransfersOut}
                flex={5}
              ></AgGridColumn>
              <AgGridColumn
                field="transfersIn"
                headerName="Transfers In"
                valueGetter={getTransfersIn}
                flex={5}
              ></AgGridColumn>
            </AgGridReact>
          </div>
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
    imageElement.src = window.location.origin + "/up-arrow.svg";
  } else if (positionChange < 0) {
    imageElement.src = window.location.origin + "/down-arrow.svg";
  } else {
    imageElement.src = window.location.origin + "/equals.svg";
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
    .map(
      (element) =>
        _.find(params.context.state.about.elements, { id: element }).web_name
    )
    .value()
    .join(", ");
}

function getTransfersOut(params) {
  return _.chain(params.data.player_pick.transfers)
    .filter({ event: params.context.state.currentGameweek.id })
    .map("element_out")
    .map(
      (element) =>
        _.find(params.context.state.about.elements, { id: element }).web_name
    )
    .value()
    .join(", ");
}
