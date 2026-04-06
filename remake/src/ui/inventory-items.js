function itemDef(id, iconStem, description, pictureStem = iconStem) {
  return Object.freeze({
    id,
    iconAsset: `${iconStem}ICON`,
    pictureAsset: `${pictureStem}PICT`,
    description,
  });
}

export const INVENTORY_ITEM_DEFS = Object.freeze({
  passport: itemDef('passport', 'PASSPORT', 'This is your passport.'),
  letter: itemDef('letter', 'LETTER', 'This is a letter from the Spy Master to Walter.'),
  coupon: itemDef('coupon', 'COUPON', 'This is a coupon.'),
  zooCoupon: itemDef('zooCoupon', 'ZOOCOUPON', 'This is a zoo coupon.'),
  chocolate: itemDef('chocolate', 'CHOCOLATE', 'This is a bar of chocolate.'),
  credit: itemDef('credit', 'CREDIT', 'This is a credit card.'),
  key303: itemDef('key303', 'KEY303', 'This is the key to room 303.'),
  pin: itemDef('pin', 'PIN', 'This is a safety pin.'),
  drawerKey: itemDef('drawerKey', 'DRAWERKEY', 'This is a drawer key.'),
  glue: itemDef('glue', 'GLUE', 'This is a tube of glue.'),
  burger: itemDef('burger', 'BURGER', 'This is a hamburger.'),
  drink: itemDef('drink', 'DRINK', 'This is a drink.'),
  egg: itemDef('egg', 'EGG', 'This is an egg.'),
  envelope: itemDef('envelope', 'ENVELOPE', 'This is an envelope.'),
  beef: itemDef('beef', 'BEEF', 'This is raw beef.'),
  hotdog: itemDef('hotdog', 'HOTDOG', 'This is a hot dog.'),
  notebook: itemDef('notebook', 'NOTEBOOK', "This is Walter's notebook."),
  photo: itemDef('photo', 'PHOTO', 'This is a photograph.', 'PICTURE'),
  milk: itemDef('milk', 'MILK', 'This is a bottle of milk.'),
  peanut: itemDef('peanut', 'PEANUT', 'These are peanuts.'),
  idCard: itemDef('idCard', 'IDCARD', 'This is an ID card.'),
  zooTicket: itemDef('zooTicket', 'ZOOTICKET', 'This is a zoo ticket.', 'ZOOPASS'),
  hammer: itemDef('hammer', 'HAMMER', 'This is a hammer.'),
  brain: itemDef('brain', 'BRAIN', 'This is a brain.'),
});

export const INVENTORY_ICON_NAME_TO_ITEM_ID = Object.freeze({
  PassportIcon: 'passport',
  LetterIcon: 'letter',
  CouponIcon: 'coupon',
  ZooCouponIcon: 'zooCoupon',
  ChocolateIcon: 'chocolate',
  CreditIcon: 'credit',
  Key303Icon: 'key303',
  PinIcon: 'pin',
  DrawerKeyIcon: 'drawerKey',
  GlueIcon: 'glue',
  BurgerIcon: 'burger',
  DrinkIcon: 'drink',
  EggIcon: 'egg',
  EnvelopeIcon: 'envelope',
  BeefIcon: 'beef',
  HotDogIcon: 'hotdog',
  NotebookIcon: 'notebook',
  PhotoIcon: 'photo',
  MilkIcon: 'milk',
  PeanutIcon: 'peanut',
  IDCardIcon: 'idCard',
  ZooTicketIcon: 'zooTicket',
  HammerIcon: 'hammer',
  BrainIcon: 'brain',
});

export const INVENTORY_ITEM_ID_TO_ICON_NAME = Object.freeze(
  Object.fromEntries(Object.entries(INVENTORY_ICON_NAME_TO_ITEM_ID).map(([iconName, itemId]) => [itemId, iconName]))
);
