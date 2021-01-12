import {
	BigInt,
	Address,
	Bytes,
	BigDecimal,
	log
} from "@graphprotocol/graph-ts"
import {
  ShardGovernor,
  NewShotgun,
  // NftRedeemed,
  // ShardsClaimed,
  // ShardsCollected,
  ShotgunEnacted
} from "../generated/ShardGovernor/ShardGovernor"
import {
	ShardRegistry
} from "../generated/ShardGovernor/ShardRegistry"
import {
	ShotgunClause
} from "../generated/ShardGovernor/ShotgunClause"
import { Shotgun } from "../generated/schema"

function toDecimal(value: BigInt, decimals: u32 = 18): BigDecimal {
  let precision = BigInt.fromI32(10)
    .pow(<u8>decimals)
    .toBigDecimal();

  return value.divDecimal(precision);
}

export function handleNewShotgun(event: NewShotgun): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  // let entity = Shotgun.load(event.transaction.from.toHex())
	let entity = Shotgun.load(event.params.shotgun.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (entity == null) {
    entity = new Shotgun(event.params.shotgun.toHex())

    // Entity fields can be set using simple assignments
    // entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  // entity.count = entity.count + BigInt.fromI32(1)

	entity.shardRegistry = event.transaction.to as Address
	entity.initialClaimant = event.transaction.from
	entity.totalValue = event.transaction.value
	entity.block = event.block.number
	entity.createdAt = event.block.timestamp

	let shardRegistry = ShardRegistry.bind(event.transaction.to as Address)
	let shotgunClause = ShotgunClause.bind(event.params.shotgun as Address)

	let capResult = shardRegistry.try_cap()
	let symResult = shardRegistry.try_symbol()
	let priResult = shotgunClause.try_pricePerShardInWei()
	let dedResult = shotgunClause.try_deadlineTimestamp()

	if (capResult.reverted) {
		log.warning("try_cap reverted: {}", [event.transaction.to.toHexString()])
	} else if (symResult.reverted) {
		log.warning("try_symbol reverted: {}", [event.transaction.to.toHexString()])
	} else if (priResult.reverted) {
		log.warning("try_pricePerShardInWei reverted: {}", [event.params.shotgun.toHexString()])
	} else if (dedResult.reverted) {
		log.warning("try_deadlineTimestamp reverted: {}", [event.params.shotgun.toHexString()])
	} else {
		let supply = toDecimal(capResult.value)

		entity.symbol = symResult.value

		let pricePerShardInEth = toDecimal(priResult.value)
		entity.pricePerShardInEth = pricePerShardInEth

		let v = pricePerShardInEth * supply
		entity.valuationInEth = v

		entity.deadline = dedResult.value
		entity.enacted = false
		entity.winner = "None"

		entity.save()
	}


  // Entity fields can be set based on event parameters
  // entity.shotgunAddress = event.params.shotgun

  // Entities can be written to the store with `.save()`

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.checkLock(...)
  // - contract.checkShotgunState(...)
  // - contract.currentShotgunClause(...)
  // - contract.getContractBalance(...)
  // - contract.getNftRegistryAddresses(...)
  // - contract.getNftTokenIds(...)
  // - contract.getOwner(...)
  // - contract.offererAddress(...)
  // - contract.onERC721Received(...)
  // - contract.shardOfferingAddress(...)
  // - contract.shardRegistryAddress(...)
  // - contract.shotgunAddressArray(...)
  // - contract.shotgunCounter(...)
}

export function handleShotgunEnacted(event: ShotgunEnacted): void {
	let entity = Shotgun.load(event.params.enactor.toHex())
	if (entity !== null) {
		let shotgunClause = ShotgunClause.bind(event.params.enactor as Address)
		
		entity.enacted = shotgunClause.shotgunEnacted()
		let shotgunWinner = shotgunClause.claimWinner()
		if (shotgunWinner === 1) {
			entity.winner = "InitialClaimant"
		} else if (shotgunWinner === 2) {
			entity.winner = "CounterClaimant"
		}

		entity.save()
	}
}

// export function handleNftRedeemed(event: NftRedeemed): void {}
//
// export function handleShardsClaimed(event: ShardsClaimed): void {}
//
// export function handleShardsCollected(event: ShardsCollected): void {}
//
