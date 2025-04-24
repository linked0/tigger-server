# bizboa-bridge-server

## Change setting

#### 1. env/.env
Change network information if needed

```
STANDALONE_URL=http://localhost:8585
MARIGOLD_URL=http://localhost:8885
MARIGOLD_LOCALNET_URL=http://localhost:8885
```

#### 2. config.yaml
Set loggin level and network
```
level: debug
```
```
bridge:
  ethnet_network: "marigold_localnet"
  biznet_network: "localnet"
```
```
token_bridge:
  ethnet_network: "marigold_localnet"
  biznet_network: "localnet"
```

#### 3. hardhat.config.ts
- Set network info if needed

#### 4. src/service/scheduler/GasPriceScheduler.ts
Default provider (It should be on Ethereum testnet not Poonet)
```
const provider = await ethers.getDefaultProvider("http://localhost:8885");
```

#### 5. Setup database
1. If you didn't install the mysql server, please install.
  - https://dev.mysql.com/downloads/mysql/

2. Create config file
  - sudo vi `/etc/my.cnf`
  ```
  [mysqld]
  port=3306
  bind-address=127.0.0.1

  socket=/tmp/mysql.sock
  ```
  - Restart server
  ```
  sudo /usr/local/mysql/support-files/mysql.server restart
  ```

3. Create user and previleges
```
  CREATE USER 'devswap_user'@'localhost' IDENTIFIED BY 'mypassword';
```

4. Database Creation: Already exists in `src/modules/storage/Storage.ts`
```
this.query(`CREATE DATABASE IF NOT EXISTS \`${databaseConfig.database}\`;`, [])
  .then(async (result) => {
      dbconfig.database = databaseConfig.database;
      this.pool = mysql.createPool(dbconfig);
      this.createTables()
          .then(() => {
              if (callback != null) callback(null);
          })
          .catch((err: any) => {
              if (callback != null) callback(err);
          });
  })
  .catch((err) => {
      if (callback != null) callback(err);
  });
```
- 만약 데이터베이스 생성을 따로 진행하고 싶으면 `script/init-db.ts` 참조. 완성된 코드는 아니고, 참고용.

5. Check in MySQLWorkbench
- Add connection to `devswap9` database and connect.

## Setup & Test

```bash
$ git submodule update --init
$ ./copy_contracts.sh
$ npm install
$ cp env/.env.sample env/.env
$ npx hardhat compile
$ npx hardhat test
```

## Run
```
yarn start:dev
```

다음의 로그가 나타나는 것은 정상
```
$ NODE_ENV=development node_modules/.bin/hardhat run src/main.ts
환경 변수에 `FEE_MANAGER_ADDRESS` 이 존재하지 않아서 무작위로 생성합니다.
```

## 테스트넷에서 BOA Bridge 테스트 하기
See [BOA Bridge]

## 테스트넷에서 Token Bridge 테스트 하기
See [Token Bridge]

[BOA Bridge]: ./doc/BOABridgeTestNetEnv.md  

[Token Bridge]: ./doc/TokenBridgeTestNetEnv.md

## API

### Post Swap Info 

The front-end deposits the token in the deposit box in the smart contract and delivers the information to the server.   

Request :

> * Endpoint : `/bridge/deposit`
>
> * Method : POST
>
> * Parameter :
>
>> * id : ID of deposit lock box
>> * type : Type of swap (0: BOA, 1: Token)
>> * trader_address : Address of trader
>> * withdraw_address : Address of recipient  
>> * amount : Amount to swap
>> * swap_fee : Swap fees
>> * tx_fee : Transaction fees to be used on the Ethereum mainnet
>> * direction : 0: Ethereum -> BizNet; 1: BizNet -> Ethereum
>> * secret_lock : Hash of secret key
>> * tx_hash : Transaction Hash 


Response :

> * status : Response code
> * error : Exists only when an error occurs
>> * message : Error message
> * data : Response Data
>> * id : ID of deposit lock box

---

### Close Swap

After checking the creation and contents of the withdrawal box at the front end, the key is sent to the server.  
This is to increase user convenience by automatically processing the swap from start to finish.

Request :

> * Endpoint : `/bridge/close`
> * Method : POST
> * Parameter :
>> * id : ID of deposit lock box  
>> * key : Secret key


Response :

> * status : Response code
> * error : Exists only when an error occurs
>> * message : Error message
> * data : Response Data
>> * id : ID of deposit lock box  

---

### Get Contracts Info

Request :

> * Endpoint : `/bridge/contracts`
> * Method : GET
> * Parameter :


Response :

> * status : Response code
> * error : Exists only when an error occurs
>> * message : Error message
> * data : Response Data
```json
{
  "boa_bridge": {
    "boa_ethnet_address": "0x10Da82287982A7e3E718F9adE892a566F92C1Be2",
    "bridge_ethnet_address": "0xb37AE78ab51e6573370060BD3910d0eBa0bFC75d",
    "bridge_biznet_address": "0x4ef6131d042Aa3AE35517ad3171c6aC1CCEd2C6E",
    "gas_usage": {
      "open_deposit": 213968,
      "close_deposit": 79238,
      "open_withdraw": 197145,
      "close_withdraw": 111016
    },
    "fee": 30
  },
  "token_bridge": {
    "bridge_ethnet_address": "0xbf066aC9e457eCa3665B4B69a952D1eF843030C1",
    "bridge_biznet_address": "0x8EC25e7515132f9a9082d3ab967936D793B5a6F4",
    "tokens": [
      {
        "ethnet": "0x041bF532CfC8F42ABc0B5A85b4B07D3bc1d6681c",
        "biznet": "0x7D1b5ee40F9608Bc42Ed2A3AA6Df1416fFFd1eF0"
      },
      {
        "ethnet": "0x5e4108255F5fC1213c72818AB8AcCDb0a04cC830",
        "biznet": "0x221E89b8926fF60f47713850BE73eCF16d966D74"
      }
    ],
    "gas_usage": {
      "open_deposit": 213968,
      "close_deposit": 79238,
      "open_withdraw": 197145,
      "close_withdraw": 111016
    },
    "fee": 0
  }
}
```

---

### Get Fees Info

Request :

> * Endpoint : `/bridge/fees`  
> * Method : GET  
> * Parameter :  
>> * amount : Amount to swap  
>> * type : Type of swap (0: BOA, 1: Token)  
>> * direction : 0: Ethereum -> BizNet; 1: BizNet -> Ethereum  
> 
> If the `type` is 0, the currency of the fee is `BOA`.  
> If the `type` is 1, `ETH` is when `direction` is 0, and `BOA` is when `direction` is 1.  
> Please refer to the test code because the method of entering the fee into the contract is different depending on the `type`.  

Response :

> * status : Response code
> * error : Exists only when an error occurs
>> * message : Error message
> * data : Response Data
>> * swap_fee : Swap fees  
>> * tx_fee : Transaction fees to be used on the Ethereum mainnet
