import { createRoot } from "react-dom/client"
import { HashRouter as Router } from "react-router-dom"
import { Provider } from "react-redux"
import { store } from "./state/store"
import Tabs from "./tabs"
import "./index.css"
import AppLayout from "./Layout"
import React from "react"

function init() {
  const appContainer = document.createElement("div")
  appContainer.id = "appContainer"
  document.body.appendChild(appContainer)

  if (!appContainer) {
    throw new Error("Can not find AppContainer")
  }

  const root = createRoot(appContainer)
  root.render(
    <Provider store={store}>
      <Router>
        <AppLayout>
          <Tabs />
        </AppLayout>
      </Router>
    </Provider>,
  )
}

init()
