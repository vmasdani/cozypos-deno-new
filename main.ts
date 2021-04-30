import { Application, Router } from "https://deno.land/x/oak@v7.3.0/mod.ts";
import {
  DataTypes,
  Database,
  Model,
  Relationships,
  SQLite3Connector,
} from "https://deno.land/x/denodb@v1.0.37/mod.ts";
import { readCSV, readCSVObjects } from "https://deno.land/x/csv@v0.5.1/mod.ts";
import { makeDateString } from "./helpers.ts";

const connection = new SQLite3Connector({ filepath: "./data.sqlite3" });
const db = new Database(connection);

const baseModel = {
  id: { primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },
  uuid: DataTypes.STRING,
  hidden: DataTypes.BOOLEAN,
  ordering: DataTypes.INTEGER,
};

class Project extends Model {
  static table = "projects";
  static timestamps = true;

  static fields = {
    ...baseModel,
    name: DataTypes.TEXT,
    date: DataTypes.DATETIME,
  };

  static transactions() {
    return this.hasMany(Transaction);
  }
}

class Item extends Model {
  static table = "items";
  static timestamps = true;

  static fields = {
    ...baseModel,
    name: DataTypes.TEXT,
    desc: DataTypes.TEXT,
    price: DataTypes.FLOAT,
    manufacturingPrice: DataTypes.FLOAT,
  };

  static itemTransactions() {
    return this.hasMany(ItemTransaction);
  }
}

class Transaction extends Model {
  static table = "transactions";
  static timestamps = true;

  static fields = {
    ...baseModel,
    customPrice: DataTypes.FLOAT,
    cashier: DataTypes.TEXT,
    projectId: DataTypes.INTEGER,
    testField: DataTypes.INTEGER,
  };

  static project() {
    return this.hasOne(Project);
  }

  static itemTransactions() {
    return this.hasMany(ItemTransaction);
  }
}

class ItemTransaction extends Model {
  static table = "item_transactions";
  static timestamps = true;

  static fields = {
    ...baseModel,
    itemId: DataTypes.INTEGER,
    transactionId: DataTypes.INTEGER,
  };

  static item() {
    return this.hasOne(Item);
  }

  static transaction() {
    return this.hasOne(Transaction);
  }
}

// Transaction
// Relationships.belongsTo(Transaction, Project);

// // ItemTransaction
// Relationships.belongsTo(ItemTransaction, Item);
// Relationships.belongsTo(ItemTransaction, Transaction);

db.link([Item, Transaction, ItemTransaction, Project]);

await db.sync();

// const newProject = new Project();
// newProject.name = "test Project";
// newProject.date = makeDateString(new Date());

// const savedProject = await newProject.save();

// const newItem = new Item();
// newItem.name = "Test item";
// newItem.desc = "Test desc";
// newItem.price = 10000;
// newItem.manufacturingPrice = 2500;

// const savedItem = await newItem.save();

// console.log("Saved item:", savedItem, savedItem.lastInsertId);

// const newTransaction = new Transaction();
// newTransaction.projectId = savedProject.lastInsertId;
// const savedTransaction = await newTransaction.save();

// console.log(
//   "Saved transaction:",
//   savedTransaction,
//   savedTransaction.lastInsertId
// );

// const newItemTransaction = new ItemTransaction();
// newItemTransaction.itemId = savedItem.lastInsertId;
// newItemTransaction.transactionId = savedTransaction.lastInsertId;

// const savedItemTransaction = await newItemTransaction.save();

// console.log("Saved item transaction:", savedItemTransaction);

// console.log(
//   "Get value:",
//   await ItemTransaction.where(
//     "id",
//     `${savedItemTransaction.lastInsertId}`
//   ).first(),
//   await ItemTransaction.where(
//     "id",
//     `${savedItemTransaction.lastInsertId}`
//   ).transaction(),
//   await ItemTransaction.where(
//     "id",
//     `${savedItemTransaction.lastInsertId}`
//   ).item(),
//   await Transaction.where("id", `${savedProject.lastInsertId}`).project()

//   //   await gotItemTransaction.transaction(),
//   //   await gotItemTransaction.item()
// );

const router = new Router();

const populate = async () => {
  //  Create new project
  const newProject = new Project();
  newProject.name = "CF14";
  newProject.date = new Date(2020, 1, 23);
  const projectId = (await newProject.save()).lastInsertId;

  // Items
  const itemsFile = await Deno.open("./cozypos-full/csv/items.csv");
  for await (const obj of readCSVObjects(itemsFile)) {
    const newItem = new Item();
    // newItem.id = obj.id;
    newItem.uuid = `item-${obj.id}`;
    newItem.name = obj.name;
    newItem.desc = obj.desc;
    newItem.price = isNaN(parseFloat(obj.price)) ? parseFloat(obj.price) : 0;
    newItem.manufacturingPrice = isNaN(parseFloat(obj.manufacturing_price))
      ? null
      : parseFloat(obj.manufacturing_price);

    // console.log(newItem);
    newItem.save();
  }
  itemsFile.close();

  // Transactions
  const transactionsFile = await Deno.open(
    "./cozypos-full/csv/transactions.csv"
  );
  for await (const obj of readCSVObjects(transactionsFile)) {
    const newTransaction = new Transaction();
    newTransaction.uuid = `transaction-${obj.id}`;
    newTransaction.customPrice = obj.custom_price;
    newTransaction.cashier = obj.cashier;
    newTransaction.projectId = projectId;

    newTransaction.save();
  }
  transactionsFile.close();

  // ItemTransactions
  const itemTransactionsFile = await Deno.open(
    "./cozypos-full/csv/itemtransactions.csv"
  );
  for await (const obj of readCSVObjects(itemTransactionsFile)) {
    console.log(obj);

    const newItemTransaction = new ItemTransaction();
    newItemTransaction.uuid = obj.uuid;
    newItemTransaction.itemId =
      (await Item.where("uuid", `item-${obj.item_id}`).first())?.id ?? null;
    newItemTransaction.transactionId =
      (
        await Transaction.where(
          "uuid",
          `transaction-${obj.transaction_id}`
        ).first()
      )?.id ?? null;
    newItemTransaction.qty = isNaN(parseInt(obj.qty)) ? 0 : parseInt(obj.qty);

    newItemTransaction.save();
  }
  itemTransactionsFile.close();

  // // ItemStockInts
  // const itemStockInsFile = await Deno.open(
  //   "./cozypos-full/csv/itemstockins.csv"
  // );
  // for await (const obj of readCSVObjects(itemStockInsFile)) {
  //   console.log(obj);
  // }
  // itemStockInsFile.close();
};

await populate();

router
  .get("/", (ctx) => {
    ctx.response.body = "Hello world.";
  })
  .get("/items", async (ctx) => {
    ctx.response.body = await Item.all();
  })
  .get("/transactions", async (ctx) => {
    ctx.response.body = await Transaction.all();
  })
  .get("/itemtransactions", async (ctx) => {
    ctx.response.body = await ItemTransaction.all();
  })
  .get("/projects", async (ctx) => {
    ctx.response.body = await Project.all();
  })
  .get("/projects/:id", async (ctx) => {
    ctx.response.body = await Project.where("id", `${ctx.params.id}`).first();
  })
  .get("/projects/:id/transactions", async (ctx) => {
    ctx.response.body = {
      project: await Project.where("id", `${ctx.params.id}`).first(),
      transactions: (
        await Promise.all(
          ((await Transaction.where(
            "projectId",
            `${ctx.params.id}`
          ).get()) as Transaction[]).map(async (transaction) => ({
            transaction: transaction,
            itemTransactions: await Promise.all(
              ((await ItemTransaction.where(
                "transactionId",
                `${transaction.id}`
              ).get()) as ItemTransaction[]).map(async (itemTransaction) => ({
                itemTransaction: itemTransaction,
                item: await Item.where(
                  "id",
                  `${itemTransaction.itemId}`
                ).first(),
              }))
            ),
          }))
        )
      ).sort(
        (a, b) =>
          ((b.transaction.id as number) ?? 0) -
          ((a.transaction.id as number) ?? 0)
      ),
    };
  })

  .get("/populate", async (ctx) => {
    console.log("Populating...");

    ctx.response.body = "Success.";
  });

const app = new Application();
app.use(router.routes());

app.use(router.allowedMethods());

console.log("Listening on port 8081.");
await app.listen({ port: 8081 });
