import random
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.pet import Pet
from models.egg import Egg
from models.user import User
from models.transaction import Transaction
from schemas.shop import PetOut, PetBattleResult, EggOut, HatchEggResult, FeedPetResult
from services.game_service import get_current_energy, MAX_ENERGY
from services.shop_service import PET_TYPES, FOOD_DATA, EGG_DATA

# ── Константы энергии питомца ─────────────────────────────────────────────────
PET_MAX_ENERGY = 20
PET_ENERGY_PER_BATTLE = 5
PET_ENERGY_REGEN_SECONDS = 600     # +1 энергия каждые 10 мин
PET_BATTLE_COOLDOWN_SECONDS = 600  # кулдаун между боями

# ── Константы голода питомца ──────────────────────────────────────────────────
PET_MAX_HUNGER = 100
HUNGER_DEPLE_SECONDS = 1200        # -1 голод каждые 20 мин


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Голод ─────────────────────────────────────────────────────────────────────
def get_pet_current_hunger(pet: Pet) -> int:
    if pet.hunger_updated_at is None:
        return pet.hunger
    elapsed = (now_utc() - pet.hunger_updated_at).total_seconds()
    depleted = int(elapsed // HUNGER_DEPLE_SECONDS)
    return max(0, pet.hunger - depleted)


def get_hunger_deple_next_in(pet: Pet) -> int:
    """Секунд до следующего -1 голода. 0 — если голод уже 0."""
    hunger = get_pet_current_hunger(pet)
    if hunger <= 0:
        return 0
    if pet.hunger_updated_at is None:
        return HUNGER_DEPLE_SECONDS
    elapsed = (now_utc() - pet.hunger_updated_at).total_seconds()
    return max(0, int(HUNGER_DEPLE_SECONDS - (elapsed % HUNGER_DEPLE_SECONDS)))


def hunger_status_label(hunger: int) -> str:
    if hunger >= 70:
        return "Сытый"
    if hunger >= 30:
        return "Голодный"
    if hunger >= 1:
        return "Умирает с голоду"
    return "Истощён"


# ── Энергия питомца ───────────────────────────────────────────────────────────
def get_pet_current_energy(pet: Pet) -> int:
    if pet.energy_updated_at is None:
        return pet.energy
    elapsed = (now_utc() - pet.energy_updated_at).total_seconds()
    regenerated = int(elapsed // PET_ENERGY_REGEN_SECONDS)
    return min(PET_MAX_ENERGY, pet.energy + regenerated)


def get_pet_energy_next_in(pet: Pet) -> int:
    energy = get_pet_current_energy(pet)
    if energy >= PET_MAX_ENERGY:
        return 0
    if pet.energy_updated_at is None:
        return PET_ENERGY_REGEN_SECONDS
    elapsed = (now_utc() - pet.energy_updated_at).total_seconds()
    return max(0, int(PET_ENERGY_REGEN_SECONDS - (elapsed % PET_ENERGY_REGEN_SECONDS)))


def get_pet_effective_power(pet: Pet) -> int:
    """Эффективный power_bonus с учётом энергии и голода."""
    energy = get_pet_current_energy(pet)
    hunger = get_pet_current_hunger(pet)
    energy_ratio = energy / PET_MAX_ENERGY
    hunger_ratio = hunger / PET_MAX_HUNGER
    return int(pet.power_bonus * energy_ratio * hunger_ratio)


def get_pet_cooldown_seconds(pet: Pet) -> int:
    if not pet.last_battle_at:
        return 0
    elapsed = (now_utc() - pet.last_battle_at).total_seconds()
    remaining = PET_BATTLE_COOLDOWN_SECONDS - elapsed
    return max(0, int(remaining))


def pet_to_out(pet: Pet) -> PetOut:
    energy = get_pet_current_energy(pet)
    hunger = get_pet_current_hunger(pet)
    cooldown = get_pet_cooldown_seconds(pet)
    can_battle = energy >= PET_ENERGY_PER_BATTLE and cooldown == 0
    effective_power = get_pet_effective_power(pet)
    return PetOut(
        id=pet.id,
        name=pet.name,
        pet_type=pet.pet_type,
        rarity=pet.rarity,
        level=pet.level,
        power_bonus=pet.power_bonus,
        effective_power_bonus=effective_power,
        gold_bonus=pet.gold_bonus,
        energy=energy,
        max_energy=PET_MAX_ENERGY,
        energy_regen_seconds=PET_ENERGY_REGEN_SECONDS,
        energy_next_in=get_pet_energy_next_in(pet),
        last_battle_at=pet.last_battle_at.isoformat() if pet.last_battle_at else None,
        can_battle=can_battle,
        battle_cooldown_seconds=cooldown,
        hunger=hunger,
        hunger_status=hunger_status_label(hunger),
        hunger_deple_seconds=get_hunger_deple_next_in(pet),
    )


# ── CRUD питомцев ─────────────────────────────────────────────────────────────
async def get_user_pets(db: AsyncSession, user: User) -> list[PetOut]:
    return [pet_to_out(p) for p in user.pets]


async def release_pet(db: AsyncSession, user: User, pet_id: int) -> dict:
    result = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.owner_id == user.id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Питомец не найден")
    pet_name = pet.name
    await db.delete(pet)
    await db.commit()
    return {"pet_name": pet_name, "message": f"💔 {pet_name} отпущен на волю. Удачи ему!"}


async def feed_pet(db: AsyncSession, user: User, pet_id: int, food_type: str) -> FeedPetResult:
    food = FOOD_DATA.get(food_type)
    if not food:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Такой еды нет")

    result = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.owner_id == user.id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Питомец не найден")

    if user.coins < food["cost"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {food['cost']} монет")

    current_hunger = get_pet_current_hunger(pet)

    if food["hunger_restore"] == -1:
        new_hunger = PET_MAX_HUNGER
    else:
        new_hunger = min(PET_MAX_HUNGER, current_hunger + food["hunger_restore"])

    user.coins -= food["cost"]
    pet.hunger = new_hunger
    pet.hunger_updated_at = now_utc()

    db.add(Transaction(user_id=user.id, amount=-food["cost"], type="food",
                       description=f"Кормёжка {pet.name} ({food['name']})"))
    await db.commit()

    return FeedPetResult(
        pet_name=pet.name,
        food_name=food["name"],
        hunger_before=current_hunger,
        hunger_after=new_hunger,
        coins_spent=food["cost"],
        new_balance=user.coins,
        message=f"{food['emoji']} {pet.name} накормлен! Голод: {current_hunger} → {new_hunger}"
    )


# ── Яйца ─────────────────────────────────────────────────────────────────────
async def list_user_eggs(db: AsyncSession, user: User) -> list[EggOut]:
    result = await db.execute(
        select(Egg).where(Egg.owner_id == user.id, Egg.is_hatched == False)
        .order_by(Egg.created_at.asc())
    )
    eggs = result.scalars().all()
    out = []
    n = now_utc()
    for egg in eggs:
        pt = PET_TYPES.get(egg.pet_type, {})
        secs_left = max(0, int((egg.hatches_at - n).total_seconds()))
        out.append(EggOut(
            id=egg.id,
            egg_type=egg.egg_type,
            pet_type=egg.pet_type,
            pet_name=pt.get("name", egg.pet_type),
            pet_emoji=pt.get("emoji", "🐾"),
            rarity=pt.get("rarity", "common"),
            hatches_at=egg.hatches_at.isoformat(),
            hatch_seconds_left=secs_left,
            is_ready=secs_left == 0,
            created_at=egg.created_at.isoformat(),
        ))
    return out


async def hatch_egg(db: AsyncSession, user: User, egg_id: int) -> HatchEggResult:
    result = await db.execute(
        select(Egg).where(Egg.id == egg_id, Egg.owner_id == user.id, Egg.is_hatched == False)
    )
    egg = result.scalar_one_or_none()
    if not egg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Яйцо не найдено")

    if now_utc() < egg.hatches_at:
        secs = int((egg.hatches_at - now_utc()).total_seconds())
        m, s = divmod(secs, 60)
        h, m = divmod(m, 60)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Яйцо ещё не готово. Осталось: {h}ч {m}м {s}с"
        )

    # Проверяем лимит питомцев
    from services.shop_service import MAX_PETS
    max_pets = MAX_PETS.get(user.castle_level, 1)
    if len(user.pets) >= max_pets:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Достигнут лимит питомцев ({max_pets}). Отпусти кого-нибудь или улучши замок!"
        )

    pt = PET_TYPES.get(egg.pet_type, {})
    pet = Pet(
        owner_id=user.id,
        name=f"{pt.get('emoji', '🐾')} {pt.get('name', egg.pet_type)}",
        pet_type=egg.pet_type,
        rarity=pt.get("rarity", "common"),
        level=1,
        power_bonus=pt.get("power_bonus", 0),
        gold_bonus=pt.get("gold_bonus", 0),
        energy=PET_MAX_ENERGY,
        hunger=PET_MAX_HUNGER,
    )
    db.add(pet)
    egg.is_hatched = True
    await db.commit()

    return HatchEggResult(
        pet_name=pet.name,
        pet_type=egg.pet_type,
        rarity=pt.get("rarity", "common"),
        power_bonus=pt.get("power_bonus", 0),
        gold_bonus=pt.get("gold_bonus", 0),
        message=f"🎉 Вылупился {pet.name}! +{pt.get('power_bonus', 0)} к силе."
    )


# ── Бой питомца ───────────────────────────────────────────────────────────────
async def do_pet_battle(db: AsyncSession, user: User, pet_id: int) -> PetBattleResult:
    result = await db.execute(select(Pet).where(Pet.id == pet_id, Pet.owner_id == user.id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Питомец не найден")

    cooldown = get_pet_cooldown_seconds(pet)
    if cooldown > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Питомец устал. Подожди ещё {cooldown // 60} мин {cooldown % 60} сек.")

    current_energy = get_pet_current_energy(pet)
    if current_energy < PET_ENERGY_PER_BATTLE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Мало энергии у питомца ({current_energy}/{PET_MAX_ENERGY}). "
                            f"+1 каждые 10 минут.")

    # Сила питомца учитывает голод
    hunger = get_pet_current_hunger(pet)
    pet_power = int((pet.power_bonus + pet.level * 2) * (hunger / PET_MAX_HUNGER))
    bot_power = max(1, int(pet_power * random.uniform(0.7, 1.3)))
    success = pet_power > bot_power

    energy_gained = 0
    extra_penalty = 0
    n = now_utc()

    if success:
        player_energy = get_current_energy(user)
        energy_gained = random.randint(1, 20)
        user.energy = min(MAX_ENERGY, player_energy + energy_gained)
        user.energy_updated_at = n
        db.add(Transaction(user_id=user.id, amount=energy_gained, type="pet_battle",
                           description=f"Победа в бою питомца {pet.name}"))
    else:
        extra_penalty = 5

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
        msg = f"💀 {pet.name} проиграл. Штраф: -{total_spent} энергии питомца."

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
