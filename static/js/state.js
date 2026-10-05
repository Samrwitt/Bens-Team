// Workspace data and assignment-list preferences shared by the screens.
export const state = {
  data: null,
  analysisChats: {},
  requestId: 0,
  search: "",
  filter: "All",
};

export function resetWorkspace() {
  state.requestId += 1;
  state.data = null;
  state.analysisChats = {};
  state.search = "";
  state.filter = "All";
}
