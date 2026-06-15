import { createContext, useContext } from "react";
import type { Item, PublishState } from "../types";

/** The publish capability handed to item cards, without threading props through every layer. */
export interface PublishApi {
  signedIn: boolean;
  stateOf: (item: Item) => PublishState;
  publish: (item: Item) => void;
  unpublish: (item: Item) => void;
  isBusy: (item: Item) => boolean;
}

export const PublishContext = createContext<PublishApi | null>(null);

export const usePublish = () => useContext(PublishContext);
