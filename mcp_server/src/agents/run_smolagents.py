from smolagents import CodeAgent

try:
    # Initialize agent with empty tools list
    # TODO: Consider adding appropriate tools for production use
    agent = CodeAgent(tools=[])

    # Run the agent with a test query
    result = agent.run("What is the 15th prime number?")
    print(result)
except Exception as e:
    print(f"Error running CodeAgent: {e}")
