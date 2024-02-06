# BOA Bridge의 테스트넷을 이용한 테스트 환경구축하기

## 개요
아래의 단계가 순차적으로 진행되어야 합니다.  
1. 네트워크 환경을 설정해야 합니다.
2. BOA의 컨트랙트를 각 네트워크에 배포합니다.
3. Bridge의 컨트랙트를 각 네트워크에 배포합니다. 
4. Bridge의 유동성을 공급합니다.
5. 테스트용 환경파일수정합니다
6. 테스트 실행합니다

## 네트워크 설정하기
BOA Bridge는 BOA와 WBOA를 위한 두 개의 네트워크가 필요합니다.

BOA는 EthNet에 배포된 토큰입니다.
WBOA는 BizNet에 배포된 토큰입니다.

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

### EthNet에 BOA 컨트랙트 배포하기

아래 명령어를 실행하면 EthNet에 BOA 컨트랙트가 배포되고 그 주소가 출력됩니다.

```shell
npx hardhat run scripts/boa/ethnet/deploy_boa.ts --network ethnet_sample
```

출력된 스마트컨트랙트의 주소를 파일 env/.env 의 `BOA_ETHNET_CONTRACT_ADDRESS` 에 기록합니다.

## 테스트용 Bridge 컨트랙트 배포하기

### EthNet에 Bridge 컨트랙트 배포하기

아래 명령어를 실행하면 브리지의 스마트컨트랙트가 EthNet에 배포되고 그 주소가 출력됩니다.

```shell
npx hardhat run scripts/boa/ethnet/deploy_bridge.ts --network ethnet_sample
```

출력된 스마트컨트랙트의 주소를 파일 env/.env 의 `BRIDGE_ETHNET_CONTRACT_ADDRESS` 에 기록합니다.


### BizNet에 Bridge 컨트랙트 배포하기

아래 명령어를 실행하면 브리지의 스마트컨트랙트가 BizNet에 배포되고 그 주소가 출력됩니다.

```shell
npx hardhat run scripts/boa/biznet/deploy_bridge.ts --network biznet_sample
```

출력된 스마트컨트랙트의 주소를 파일 env/.env 의 `BRIDGE_BIZNET_CONTRACT_ADDRESS` 에 기록합니다.

## 관리자와 유저계좌에 BOA 전송하기

아래 명령어를 실행하면 각 계좌에 BOA가 전송됩니다.

```shell
npx hardhat run scripts/boa/ethnet/transfer.ts --network ethnet_sample
npx hardhat run scripts/boa/biznet/transfer.ts --network biznet_sample
```

## 유동성 공급하기

### EthNet의 Bridge에 유동성 공급하기

아래 명령어를 실행하면 EthNet의 브리지에 유동성이 공급됩니다.

```shell
npx hardhat run scripts/boa/ethnet/add_liquidity.ts --network ethnet_sample
```

### BizNet에 Bridge에 유동성 공급하기

아래 명령어를 실행하면 BizNet의 브리지에 유동성이 공급됩니다.

```shell
npx hardhat run scripts/boa/biznet/add_liquidity.ts --network biznet_sample
```

## 관리자 설정하기

### EthNet 의 Bridge 에 관리자 지정

```shell
npx hardhat run scripts/boa/ethnet/add_manager.ts --network ethnet_sample
```

### BizNet 의 Bridge 에 관리자 지정

```shell
npx hardhat run scripts/boa/biznet/add_manager.ts --network biznet_sample
```

## 환경파일 수정
테스트에서 사용되는 환경파일은 config/config_test.yaml 입니다. 
여기에서 아래 부분을 수정합니다.  

```yaml
bridge:
  boa_ethnet_address: "${BOA_ETHNET_CONTRACT_ADDRESS}"
  bridge_ethnet_address: "${BRIDGE_ETHNET_CONTRACT_ADDRESS}"
  bridge_biznet_address: "${BRIDGE_BIZNET_CONTRACT_ADDRESS}"
  ethnet_interval: 14
  biznet_interval: 14
  ethnet_network: "ethnet_sample"
  biznet_network: "biznet_sample"
```


## 테스트 실행하기

테스트 파일은 test/bridge/BridgeServer.test.ts 입니다.  
아래 명령어를 실행하여 테스트를 수행합니다. 

```shell
npx hardhat test test/bridge/BridgeServer.test.ts
```

이 테스트는 토큰을 EthNet에서 BizNet으로 교환하는 코드와 BizNet에서 EthNet으로 교환하는 두개의 테스트로 구성되어 있습니다.  

## 잔고확인하기

### EthNet의 각 계정의 잔고

```shell
npx hardhat run scripts/boa/ethnet/balance.ts --network ethnet_sample
```

### BizNet의 각 계정의 잔고

```shell
npx hardhat run scripts/boa/biznet/balance.ts --network biznet_sample
```


## 참조

테스트 과정에 사용된 .env 입니다.
이를 위해 비밀키를 3개 만들었습니다. 그리고 위의 컨트랙트 배포과정을 진행하였으며, 각 테스트넷에서 3개의 계정에  Ether를 받았습니다.  
3개의 계정을 메타마스크에 추가하면 잔고를 확인할 수 있으며, BOA와 WBOA의 토큰을 추가하여 사용할 수 있습니다.

```shell
BIZNET_MAIN_NET_URL=https://mainnet.bosagora.org
BIZNET_TEST_NET_URL=https://testnet.bosagora.org
ETHNET_MAIN_NET_URL=https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161

ETHNET_SAMPLE_URL=https://bridge-a.bosagora.info
BIZNET_SAMPLE_URL=https://bridge-b.bosagora.info

# CONTRACT ADDRESS
BRIDGE_ETHNET_CONTRACT_ADDRESS=0xab929174E887E5418C1E6dB1995CDCc23AE40c89
BRIDGE_BIZNET_CONTRACT_ADDRESS=0x7f28F281d57AC7d99A8C2FAd2d37271c2c9c67D6
BOA_ETHNET_CONTRACT_ADDRESS=0xeEdC2Ac65dF232AB6d229EBD4E3F564e194ffe7D

```