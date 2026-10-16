export type WardrobeItem = {
  id: string;
  name: string;
  image_url: string;
  colors: string[];
  created_at: string;
};

export type Outfit = {
  id: string;
  image_url: string;
  item_ids: string[];
  created_at: string;
};
