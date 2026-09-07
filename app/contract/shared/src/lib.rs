#![no_std]

//! Shared types, errors, and utilities for Stellar Basic DAO sub-contracts.
//!
//! This crate provides the foundational types that all sub-contracts depend on.
//! It is a no_std library compatible with Soroban environments.

pub mod commitment;
pub mod errors;
pub mod escrow_id;
pub mod events;
pub mod nonce;
pub mod storage;
pub mod types;

#[cfg(test)]
mod commitment_tests;

#[cfg(test)]
mod types_tests;
