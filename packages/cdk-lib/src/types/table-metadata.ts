/**
 * Represents metadata extracted from a DynamoDB table for use with Chaim schema binding.
 * 
 * This class encapsulates all the relevant metadata about a DynamoDB table that
 * needs to be included in the enhanced data store sent to the Chaim API.
 */
export class TableMetadata {
  /** The name of the DynamoDB table */
  public readonly tableName: string;
  
  /** The ARN of the DynamoDB table */
  public readonly tableArn: string;
  
  /** The AWS region where the table is located */
  public readonly region: string;
  
  /** The AWS account ID where the table is located */
  public readonly account: string;
  
  /** The ARN of the encryption key used by the table (optional) */
  public readonly encryptionKey?: string;

  /** The partition key attribute name */
  public readonly partitionKey: string;

  /** The sort key attribute name (optional) */
  public readonly sortKey?: string;

  /**
   * Creates a new TableMetadata instance.
   * 
   * @param tableName - The name of the DynamoDB table
   * @param tableArn - The ARN of the DynamoDB table
   * @param region - The AWS region where the table is located
   * @param account - The AWS account ID where the table is located
   * @param partitionKey - The partition key attribute name
   * @param encryptionKey - The ARN of the encryption key used by the table (optional)
   * @param sortKey - The sort key attribute name (optional)
   */
  constructor(
    tableName: string,
    tableArn: string,
    region: string,
    account: string,
    partitionKey: string,
    encryptionKey?: string,
    sortKey?: string
  ) {
    this.tableName = tableName;
    this.tableArn = tableArn;
    this.region = region;
    this.account = account;
    this.partitionKey = partitionKey;
    this.encryptionKey = encryptionKey;
    this.sortKey = sortKey;
  }

  /**
   * Converts the metadata to a JSON-serializable object.
   * Only includes encryptionKey and sortKey if they exist.
   * 
   * @returns A plain object representation of the table metadata
   */
  public toJSON(): Record<string, any> {
    return {
      tableName: this.tableName,
      tableArn: this.tableArn,
      region: this.region,
      account: this.account,
      partitionKey: this.partitionKey,
      ...(this.sortKey && { sortKey: this.sortKey }),
      ...(this.encryptionKey && { encryptionKey: this.encryptionKey }),
    };
  }

  /**
   * Creates a TableMetadata instance from a plain object.
   * 
   * @param data - The plain object containing table metadata
   * @returns A new TableMetadata instance
   */
  public static fromJSON(data: Record<string, any>): TableMetadata {
    return new TableMetadata(
      data.tableName,
      data.tableArn,
      data.region,
      data.account,
      data.partitionKey,
      data.encryptionKey,
      data.sortKey
    );
  }

  /**
   * Validates that all required fields are present.
   * 
   * @throws Error if any required field is missing
   */
  public validate(): void {
    if (!this.tableName) {
      throw new Error('Table name is required');
    }
    if (!this.tableArn) {
      throw new Error('Table ARN is required');
    }
    if (!this.region) {
      throw new Error('Region is required');
    }
    if (!this.account) {
      throw new Error('Account is required');
    }
    if (!this.partitionKey) {
      throw new Error('Partition key is required');
    }
  }
}
