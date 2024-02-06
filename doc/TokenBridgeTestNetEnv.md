# Token Bridge의 테스트넷을 이용한 테스트 환경구축하기

## 개요
아래의 단계가 순차적으로 진행되어야 합니다.
1. 네트워크 환경을 설정해야 합니다.
2. 토큰들의 컨트랙트를 각 네트워크에 배포합니다.
3. Bridge의 컨트랙트를 각 네트워크에 배포합니다.
4. Bridge의 관리자 설정하기
5. Bridge에 토큰을 등록합니다.
6. Bridge에 유동성을 공급합니다.
7. 테스트용 환경파일수정합니다
8. 테스트 실행합니다

## 네트워크 설정하기
두 개의 네트워크가 필요합니다.

테스트를 위해 EthNet는 `ethnet_sample`를 사용합니다. 이것은 파일 `hardhat.config.ts` 에 다음과 같이 되어 있습니다.

```
    ethnet_sample: {
        url: process.env.ETHNET_SAMPLE_URL || "",
        chainId: 51029,
        accounts: getAccounts(),
    }
```

BizNet는 `biznet_sample`를 사용합니다. 이것은 파일 `hardhat.config.ts` 에 다음과 같이 되어 있습니다.

```
    biznet_sample: {
        url: process.env.BIZNET_SAMPLE_URL || "",
        chainId: 51030,
        accounts: getAccounts(),
    }
```

## 테스트용 토큰 컨트랙트 배포하기

### EthNet에 샘플 토큰 컨트랙트 배포하기

아래 명령어를 실행하면 EthNet에 샘플 토큰 컨트랙트가 배포되고 그 주소가 출력됩니다.

```shell
npx hardhat run scripts/token/ethnet/deploy_token.ts --network ethnet_sample
```

출력된 스마트컨트랙트의 주소를 파일 env/.env 의 `TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS1` 과  `TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS2` 에 기록합니다.

### BizNet에 샘플 토큰 컨트랙트 배포하기

아래 명령어를 실행하면 BizNet에 샘플 토큰 컨트랙트가 배포되고 그 주소가 출력됩니다.

```shell
npx hardhat run scripts/token/biznet/deploy_token.ts --network biznet_sample
```

출력된 스마트컨트랙트의 주소를 파일 env/.env 의 `TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS1` 과  `TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS2` 에 기록합니다.

## 테스트용 Bridge 컨트랙트 배포하기

### EthNet에 Bridge 컨트랙트 배포하기

아래 명령어를 실행하면 브리지의 스마트컨트랙트가 EthNet에 배포되고 그 주소가 출력됩니다.

```shell
npx hardhat run scripts/token/ethnet/deploy_bridge.ts --network ethnet_sample
```

출력된 스마트컨트랙트의 주소를 파일 env/.env 의 `TOKEN_BRIDGE_ETHNET_CONTRACT_ADDRESS` 에 기록합니다.


### BizNet에 Bridge 컨트랙트 배포하기

아래 명령어를 실행하면 브리지의 스마트컨트랙트가 BizNet에 배포되고 그 주소가 출력됩니다.

```shell
npx hardhat run scripts/token/biznet/deploy_bridge.ts --network biznet_sample
```

출력된 스마트컨트랙트의 주소를 파일 env/.env 의 `TOKEN_BRIDGE_BIZNET_CONTRACT_ADDRESS` 에 기록합니다.

## 관리자와 유저계좌에 토큰 전송하기

아래 명령어를 실행하면 각 계좌에 토큰이 전송됩니다.

```shell
npx hardhat run scripts/token/ethnet/transfer.ts --network ethnet_sample
npx hardhat run scripts/token/biznet/transfer.ts --network biznet_sample
```


## Bridge의 관리자 설정하기

### EthNet 의 Bridge 에 관리자 지정

```shell
npx hardhat run scripts/token/ethnet/add_manager.ts --network ethnet_sample
```

### BizNet 의 Bridge 에 관리자 지정

```shell
npx hardhat run scripts/token/biznet/add_manager.ts --network biznet_sample
```


## Bridge에 토큰 등록하기

### EthNet 의 Bridge 에 토큰 등록하기

```shell
npx hardhat run scripts/token/ethnet/register_token.ts --network ethnet_sample
```

### BizNet 의 Bridge 에 토큰 등록하기

```shell
npx hardhat run scripts/token/biznet/register_token.ts --network biznet_sample
```


## Bridge에 유동성 공급하기

### EthNet의 Bridge에 유동성 공급하기

아래 명령어를 실행하면 EthNet의 브리지에 유동성이 공급됩니다.

```shell
npx hardhat run scripts/token/ethnet/add_liquidity.ts --network ethnet_sample
```

### BizNet에 Bridge에 유동성 공급하기

아래 명령어를 실행하면 BizNet의 브리지에 유동성이 공급됩니다.

```shell
npx hardhat run scripts/token/biznet/add_liquidity.ts --network biznet_sample
```

## 환경파일 수정
테스트에서 사용되는 환경파일은 config/config_test.yaml 입니다. 
여기에서 아래 부분을 수정합니다.  

```yaml
token_bridge:
  bridge_ethnet_address: "${TOKEN_BRIDGE_ETHNET_CONTRACT_ADDRESS}"
  bridge_biznet_address: "${TOKEN_BRIDGE_BIZNET_CONTRACT_ADDRESS}"
  ethnet_interval: 1
  biznet_interval: 1
  ethnet_network: "hardhat"
  biznet_network: "hardhat"
  gas_usage_open_deposit: 213968
  gas_usage_close_deposit: 79238
  gas_usage_open_withdraw: 197145
  gas_usage_close_withdraw: 111016
  manager_key: "${MANAGER_KEY}"
  token_addresses:
    - ethnet: "${TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS1}"
      biznet: "${TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS1}"
    - ethnet: "${TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS2}"
      biznet: "${TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS2}"
```

## 테스트 실행하기

테스트 파일은 test/token_bridge/TokenBridge.test.ts 입니다.  
아래 명령어를 실행하여 테스트를 수행합니다. 

```shell
npx hardhat test test/token_bridge/TokenBridge.test.ts
```

이 테스트는 토큰을 EthNet에서 BizNet으로 교환하는 코드와 BizNet에서 EthNet으로 교환하는 두개의 테스트로 구성되어 있습니다.  

## 잔고확인하기

### EthNet의 각 계정의 잔고

```shell
npx hardhat run scripts/token/ethnet/balance.ts --network ethnet_sample
```

### BizNet의 각 계정의 잔고

```shell
npx hardhat run scripts/token/biznet/balance.ts --network biznet_sample
```


## 참조

테스트 과정에 사용된 .env 입니다.
이를 위해 비밀키를 3개 만들었습니다. 그리고 위의 컨트랙트 배포과정을 진행하였으며, 각 테스트넷에서 3개의 계정에 Ether를 받았습니다.  
3개의 계정을 메타마스크에 추가하면 잔고를 확인할 수 있습니다.

```shell
BIZNET_MAIN_NET_URL=https://mainnet.bosagora.org
BIZNET_TEST_NET_URL=https://testnet.bosagora.org
ETHNET_MAIN_NET_URL=https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161

ETHNET_SAMPLE_URL=https://bridge-a.bosagora.info
BIZNET_SAMPLE_URL=https://bridge-b.bosagora.info

# TOKEN BRIDGE CONTRACT ADDRESS
TOKEN_BRIDGE_ETHNET_CONTRACT_ADDRESS=0x10Da82287982A7e3E718F9adE892a566F92C1Be2
TOKEN_BRIDGE_BIZNET_CONTRACT_ADDRESS=0x10Da82287982A7e3E718F9adE892a566F92C1Be2
TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS1=0xb37AE78ab51e6573370060BD3910d0eBa0bFC75d
TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS1=0xb37AE78ab51e6573370060BD3910d0eBa0bFC75d
TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS2=0x608010E5Fa37a6f74C48012c0501D454f289fA4F
TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS2=0x608010E5Fa37a6f74C48012c0501D454f289fA4F

```