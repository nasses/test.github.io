# 事务

### TransactionFactory
```java
public interface TransactionFactory {
    void setProperties(Properties props);

    Transaction newTransaction(Connection conn);

    Transaction newTransaction(DataSource ds, TransactionIsolationLevel level, boolean autoCommit);
}
```
### Transaction
```java
public interface Transaction {
    Connection getConnection() throws SQLException;

    void commit() throws SQLException;

    void rollback() throws SQLException;

    void close() throws SQLException;

    Integer getTimeout() throws SQLException;
}
``` 

事务工厂的实现包括:
- JdbcTransactionFactory 使用 `JdbcTransaction`
- ManagedTransactionFactory 使用 `ManagedTransaction`
- SpringManagedTransactionFactory 使用 `SpringManagedTransaction`

JdbcTransaction 在`openConnection`时 设置了TransactionIsolationLevel 和 autoCommit

ManagedTransaction 设置了TransactionIsolationLevel 但没有设置autoCommit 另外有一个closeConnection判断是否关闭了连接

SpringManagedTransaction 是在`openConnection`时获取的数据库的 autoCommit 和 数据源的 isConnectionTransactional