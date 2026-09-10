import { priceRarity } from './case-mechanics';

export type Food = {
  customId?: string;
  name: string;
  sub: string;
  price: number;
  rarity: number;
  image: number;
  customImage?: string;
  veg?: boolean;
  quip: string;
};

// Approximate lunch portion prices in thousands of VND,
// not restaurant quotes.
export const foods: Food[] = [
  {
    name: "Cơm tấm",
    sub: "Sườn bì chả • Việt Nam",
    price: 45,
    image: 0,
    quip: "Sườn có thể gãy. Kèo này thì không."
  },
  {
    name: "Anh Hưng",
    sub: "Món ăn đẳng cấp của Mei",
    price: 500,
    image: 3,
    customImage: "avt1202.jpg",
    veg: false,
    quip: "Một pha gắp chả đi vào lòng người."
  },
  {
    name: "Phở bò",
    sub: "Tái nạm • Việt Nam",
    price: 55,
    image: 1,
    quip: "Đời có thể nhạt. Nước phở thì không."
  },
  {
    name: "Bánh mì",
    sub: "Thịt nướng • Việt Nam",
    price: 25,
    image: 2,
    quip: "Vũ khí cận chiến của dân văn phòng."
  },
  {
    name: "Bún chả",
    sub: "Chả nướng • Việt Nam",
    price: 50,
    image: 3,
    quip: "Một pha gắp chả đi vào lòng người."
  }

  // Giữ nguyên toàn bộ các món còn lại ở đây
].map(food => ({
  ...food,
  rarity: priceRarity(food.price)
}));
