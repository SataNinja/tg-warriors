import random
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.pet import Pet
from models.user import User
from models.transaction import Transaction
from schemas.shop import PetOut, PetBattleResult
from services.game_service import get_current_energy, MAX_ENERGY

PET_MAX_ENERGY = 20
PET_ENERGY_PER_BATTLE = 5
PET_ENERGY_REGEN_SECONDS = 600    # +1 энергия каждые 10 минут
PET_BATTLE_COOLDOWN_SECONDS = 600  # кулдаун 10 минут между боями


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_pet_current_energy(pet: Pet) -> int:
    if pet.energy_updated_at is None:
        return pet.energy
    elapsed = (now_utc() - pet.energy_updated_at).total_seconds()
    regenerated = int(elapsed // PET_ENERGY_REGEN_SECONDS)
    return min(PET_MAX_ENERGY, pet.energy + regenerated)


def get_pet_cooldown_seconds(pet: Pet) -> int:
    """Секунд до конца кулдауна боя."""
    if not pet.last_battle_at:
        return 0
    elapsed = (now_utc() - pet.last_battle_at).total_seconds()
    remaining = PET_BATTLE_COOLDOWN_SECONDS - elapsed
    return max(0, int(remaining))


def pet_to_out(pet: Pet) -> PetOut:
    energy = get_pet_current_energy(pet)
    cooldown = get_pet_cooldown_seconds(pet)
    can_battle = energy >= PET_ENERGY_PER_BATTLE and cooldown == 0
    return PetOut(
        id=pet.id,
        name=pet.name,
        pet_type=pet.pet_type,
        rarity=pet.rarity,
        level=pet.level,
        power_bonus=pet.power_bonus,
        gold_bonus=pet.gold_bonus,
        energy=energy,
        max_energy=PET_MAX_ENERGY,
        energy_regen_seconds=PET_ENERGY_REGEN_SECONDS,
        last_battle_at=pet.last_battle_at.isoformat() if pet.last_battle_at else None,
        can_battle=can_battle,
        battle_cooldown_seconds=cooldown,
    )


async def get_user_pets(db: AsyncSession, user: User) -> list[PetOut]:
    return [pet_to_out(p) for p in user.pets]


async def do_pet_battle(db: AsyncSession, user: User, pet_id: int) -> PetBattleResult:
    # Найти питомца
    result = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.owner_id == user.id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Питомец не найден")

    # Проверить кулдаун
    cooldown = get_pet_cooldown_seconds(pet)
    if cooldown > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Питомец устал. Подожди ещё {cooldown // 60} мин {cooldown % 60} сек.")

    # Проверить энергию питомца
    current_energy = get_pet_current_energy(pet)
    if current_energy < PET_ENERGY_PER_BATTLE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Мало энергии у питомца ({current_energy}/{PET_MAX_ENERGY}). "
                            f"+1 каждые 10 минут.")

    # Сила питомца
    pet_power = pet.power_bonus + pet.level * 2
    bot_power = max(1, int(pet_power * random.uniform(0.7, 1.3)))
    success = pet_power > bot_power

    energy_gained = 0
    extra_penalty = 0

    n = now_utc()

    if success:
        # Победа: игрок получает 1-20 энергии
        player_energy = get_current_energy(user)
        energy_gained = random.randint(1, 20)
        new_player_energy = min(MAX_ENERGY, player_energy + energy_gained)
        user.energy = new_player_energy
        user.energy_updated_at = n
        db.add(Transaction(user_id=user.id, amount=energy_gained, type="pet_battle",
                           description=f"Победа в бою питомца {pet.name}"))
    else:
        # Поражение: питомец теряет дополнительно 5 энергии
        extra_penalty = 5

    # Тратим энергию питомца
    total_spent = PET_ENERGY_PER_BATTLE + extra_penalty
    pet.energy = max(0, current_energy - total_spent)
    pet.energy_updated_at = n
    pet.last_battle_at = n

    await db.commit()
    await db.refresh(pet)

    player_energy_after = get_current_energy(user)
    pet_energy_after = get_pet_current_energy(pet)

    if success:
        msg = f"🏆 {pet.name} победил! Ты получаешь +{energy_gained} ⚡ энергии!"
    else:
        msg = f"💀 {pet.name} проиграл. Штраф: -{PET_ENERGY_PER_BATTLE + extra_penalty} энергии питомца."

    return PetBattleResult(
        success=success,
        pet_name=pet.name,
        pet_power=pet_power,
        bot_power=bot_power,
        energy_gained=energy_gained,
        pet_energy_spent=total_spent,
        pet_energy_left=pet_energy_after,
        player_energy_left=player_energy_after,
        message=msg,
    )
