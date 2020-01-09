pragma solidity >=0.5.0 <0.7.0;

/// @title Approval Storage
/// @dev An auxiliary contract for helping the clean up of storage
/// @author Ricardo Guilherme Schmidt - (Status Research & Development GmbH) 
contract ApprovalStorage {
    address owner = msg.sender;
    mapping(address => bool) public approved;

    function setApproved(address who) external {
        assert(msg.sender == owner);
        approved[who] = true;
    }

    function deleteAll() external {
        assert(msg.sender == owner);
        selfdestruct(msg.sender);
    }
}