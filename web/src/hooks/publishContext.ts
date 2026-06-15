import { createContext, useContext } from "react";
import type { Item, PublishState } from "../types";

/** The publish capability handed to item cards, without threading props through every layer. */
export interface PublishApi {
  signedIn: boolean;
  stateOf: (item: Item) => PublishState;
  publish: (item: Item) => void;
  unpublish: (item: Item) => void;
  isBusy: (item: Item) => boolean;
  /** If this local item was adopted and its source shipped a newer revision, that revision; else null. */
  updateFor: (item: Item) => number | null;
  /** The author this item was pulled from, if it was adopted; else null. */
  originOf: (item: Item) => string | null;
}

export const PublishContext = createContext<PublishApi | null>(null);

export const usePublish = () => useContext(PublishContext);
