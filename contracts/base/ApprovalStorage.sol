pragma solidity >=0.5.0 <0.7.0;

/// @title Approval Storage
/// @dev An auxiliary contract for helping the clean up of storage
/// @author Ricardo Guilherme Schmidt - (Status Research & Development GmbH) 
contract ApprovalStorage {
    address owner = msg.sender;
    mapping(address => bool) public approved;
    modifier onlyOwner {
        require(msg.sender == owner, "500");
        _;
    }

    function setApproved(address who, bool value) external onlyOwner {
        approved[who] = value;
    }

    function deleteAll() external onlyOwner {
        selfdestruct(msg.sender);
    }
}